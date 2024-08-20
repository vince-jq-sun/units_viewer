document.addEventListener('DOMContentLoaded', () => {
    // fetchUnitLabels();
    initializeCurrentTagFile()

    // Add event listeners for keydown events
    document.addEventListener('keydown', handleKeyDown);

    // Add event listener for Enter key in the search box
    const searchBox = document.getElementById('searchBox');
    searchBox.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            applySearch();
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    // Existing code...

    // Event listener for the Help button
    document.getElementById('helpButton').addEventListener('click', toggleHelpPopup);
});


document.addEventListener('DOMContentLoaded', function() {
    populateDropdown();
});

document.addEventListener('DOMContentLoaded', function() {
    fetch('/list-folder-names')
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch folder names');
        }
        return response.json();  // Parse JSON data from the response
    })
    .then(folderNames => {
        console.log('Received folder names:', folderNames);
        // Do something with folderNames here, e.g., store them, display them, etc.
        allFolderNames = folderNames;
    })
    .catch(error => {
        console.error('Error fetching folder names:', error);
    });
});

document.addEventListener('DOMContentLoaded', function() {
    // Set up the event listener for the Fill button to show the modal
    document.getElementById('fillButton').addEventListener('click', function() {
        document.getElementById('fillModal').style.display = 'block';  // Show the modal
        document.getElementById('tagFileName').textContent = currentTagFile;  // Set the current tag file name dynamically
    });

    // Set up the event listener for the Confirm button
    document.getElementById('confirmFill').addEventListener('click', function() {
        appendAllFolderNamesToNeuronLabels();  // Your function to append names, assume it's defined elsewhere
        document.getElementById('fillModal').style.display = 'none';  // Hide the modal after confirming
    });

    // Set up the event listener for the Cancel button
    document.getElementById('cancelFill').addEventListener('click', function() {
        document.getElementById('fillModal').style.display = 'none';  // Hide the modal when cancel is clicked
    });
});

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('newButton').addEventListener('click', function() {
        document.getElementById('overlay').style.display = 'block';
        document.getElementById('newFileModal').style.display = 'block';
    });

    document.getElementById('confirmButton').addEventListener('click', function() {
        // Your existing logic for what happens when the file name is confirmed
        createFile(document.getElementById('fileName').value);
        document.getElementById('overlay').style.display = 'none';
        document.getElementById('newFileModal').style.display = 'none';
    });

    document.getElementById('cancelNewButton').addEventListener('click', function() {
        document.getElementById('overlay').style.display = 'none';
        document.getElementById('newFileModal').style.display = 'none';
    });
});


let neuronLabels = {}; // Original neuron labels data (from JSON)
let activeUnitLabels = {}; // Filtered neuron labels
let neurons = []; // All neuron IDs from the original neuronLabels
let activeUnits = []; // Filtered neuron IDs
let currentUnitId = null;
let currentUnitIndex = 0;
let tagsDictionary = {}; // Dictionary with tags as keys and neuron IDs as values
let tagOccurrences = {}; // Dictionary to store tags and their summed occurrences
let scaleFactorDefault = 0.5;
let scaleFactorExtra = 0.75;
let scaleFactor = scaleFactorDefault; // Base scale factor (initial scale, e.g., 50% of original size)
let sliderScale = 1.0; // Initial displayed scale on the slider (starts at 1)
let actualScaleFactor = scaleFactor * sliderScale; // Actual scale factor for images
let firstRun = true; // Flag to check if it's the first run of the script
let tagsFile = 'tags_1.json'; // Default tags file
let currentTagFile = ''; // Global variable
let allFolderNames = [];
let notes = [];
let trackingTags = [];

function listFolderNames() {
    const fs = require('fs');
    const path = require('path');
    const figuresPath = path.join(__dirname, 'units_figures');

    fs.readdir(figuresPath, { withFileTypes: true }, (err, files) => {
        if (err) {
            console.error('Failed to list folders:', err);
            return;
        }
        allFolderNames = files
            .filter(item => item.isDirectory())
            .map(folder => folder.name);
        console.log('All Folder Names:', allFolderNames);
    });
}
        

function loadSelectedTagFile() {
    const dropdown = document.getElementById('tagFileDropdown');
    currentTagFile = dropdown.value;  // Update the global currentTagFile variable
    console.log('New tag file loaded:', currentTagFile);  // Optional: log the loaded file for debugging
    updateLastUsedTagFile(currentTagFile);  // Update the server with the new last used file
    fetchUnitLabels();  // Re-fetch the unit labels and update display
    window.location.reload();// reload current window
}

function updateLastUsedTagFile(fileName) {
    fetch('/update-last-used-tag-file', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ lastUsedTagFile: fileName })
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                throw new Error(`Failed to update log.json on the server. Status: ${response.status}, Message: ${text}`);
            });
        }
        console.log('log.json updated successfully');
    })
    .catch(error => {
        console.error('Error updating last used tag file:', error);
    });
}


function initializeCurrentTagFile() {
    let filesList = [];

    fetch('/json-files')  // Fetch available JSON files
        .then(response => response.json())
        .then(files => {
            filesList = files;  // Store files list for later use
            return fetch('/last-used-tag-file');  // Fetch last used tag file
        })
        .then(response => response.json())
        .then(lastUsedTagFile => {
            if (filesList.includes(lastUsedTagFile)) {
                currentTagFile = lastUsedTagFile;
            } else {
                currentTagFile = filesList[0]; // Default to first file if not valid
                updateLastUsedTagFile(currentTagFile);  // Update log.json with the new default
            }
            return currentTagFile;
        })
        .then(() => {
            populateDropdown();  // Populate dropdown after currentTagFile is set
            fetchUnitLabels();  // Fetch unit labels after currentTagFile is set
        })
        .catch(error => console.error('Error initializing current tag file:', error));
}

function populateDropdown() {
    fetch('/json-files')
        .then(response => response.json())
        .then(files => {
            const dropdown = document.getElementById('tagFileDropdown');
            dropdown.innerHTML = '';  // Clear existing options
            files.forEach(file => {
                const option = document.createElement('option');
                option.value = file;
                option.text = file;
                dropdown.appendChild(option);
            });
            dropdown.value = currentTagFile;  // Ensure the currentTagFile is selected in the dropdown
        })
        .catch(error => console.error('Failed to load JSON files:', error));
}


function toggleHelpPopup() {
    const helpPopup = document.getElementById('helpPopup');
    helpPopup.style.display = helpPopup.style.display === 'block' ? 'none' : 'block';
}

function openHelpPage() {
    window.open('https://github.com/vince-jq-sun/units_viewer/blob/main/README.md', '_blank');
}

function fetchUnitLabels() {
    // Ensure currentTagFile is not empty and contains the expected path if needed
    if (!currentTagFile) {
        console.error('No current tag file set.');
        return;
    }

    fetch(`units_tags/${currentTagFile}`) // Use currentTagFile to fetch the right file
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            neuronLabels = data;
            neurons = Object.keys(neuronLabels);
            console.log('Unit Labels Loaded:', neurons); // Debugging: list all neuron IDs
            resetActiveUnits(); // Initialize active neurons to all neurons
            if (activeUnits.length > 0) {
                currentUnitId = activeUnits[0]; // Assign the first neuron as the current neuron
                currentUnitIndex = 0;
                createTagsDictionary(); // Create the tags dictionary
                displayCurrentUnit();
            } else {
                console.error('No neurons found in the JSON data.');
            }
        })
        .catch(error => {
            console.error('Error fetching neuron labels:', error);
        });
}

function resetActiveUnits() {
    activeUnitLabels = { ...neuronLabels }; // Clone the original neuron labels
    activeUnits = neurons.slice(); // Clone the neuron IDs array
    createTagsDictionary(); // Ensure the tags dictionary is created for full dataset
}

function createTagsDictionary() {
    tagsDictionary = {}; // Reset the dictionary
    tagOccurrences = {}; // Reset the tag occurrences dictionary

    for (const neuronId of Object.keys(activeUnitLabels)) { // Iterate over the active dataset
        const labels = activeUnitLabels[neuronId];
        for (const label of labels) {
            if (label.startsWith('%')) continue; // Skip labels that start with '%'

            if (!tagsDictionary[label]) {
                tagsDictionary[label] = [];
                tagOccurrences[label] = 0; // Initialize occurrence count for new tags
            }
            tagsDictionary[label].push(neuronId);
            tagOccurrences[label] += 1; // Increment the occurrence count for this tag
        }
    }

    console.log('Tags Dictionary:', tagsDictionary); // Debugging: print the tags dictionary
    console.log('Tag Occurrences:', tagOccurrences); // Debugging: print the tag occurrences
}


function applySearch() {
    const searchBox = document.getElementById('searchBox');
    let searchText = searchBox.value.replace(/\s+/g, ''); // Remove all spaces

    // Check if the search box is empty
    if (searchText === '') {
        // If the search box is empty, activate the full set
        activeUnits = Object.keys(neuronLabels);
        activeUnitLabels = { ...neuronLabels };
        createTagsDictionary(); // Recreate the tags dictionary based on the full dataset
        currentUnitId = activeUnits[0];
        currentUnitIndex = 0;
        displayCurrentUnit();
        return;
    }

    // Split the string into components
    const queries = searchText.split(/([&|!])/).filter(Boolean);

    // Check the first element and adjust if necessary
    if (!['&', '|', '!'].includes(queries[0])) {
        queries.unshift('&');
    } else if (queries[0] === '|') {
        queries[0] = '&';
    }

    // Validate the search string
    if (!validateSearchString(queries)) {
        alert('Invalid search format!');
        return;
    }

    let currentSet = new Set(Object.keys(neuronLabels)); // Start with the full set of neuron IDs

    // Compute the full set with the first query
    currentSet = applyQuery(currentSet, queries[0], queries[1]);

    let orSets = [];
    let andSets = [];
    let notSets = [];

    // Organize the queries by their logical operation
    for (let i = 2; i < queries.length; i += 2) {
        const operator = queries[i];
        const nextQuery = queries[i + 1];

        if (operator === '|') {
            orSets.push(getQuerySet(nextQuery));
        } else if (operator === '&') {
            andSets.push(getQuerySet(nextQuery));
        } else if (operator === '!') {
            notSets.push(getQuerySet(nextQuery));
        }
    }

    // Apply OR operations
    if (orSets.length > 0) {
        orSets.forEach(set => {
            currentSet = new Set([...currentSet, ...set]);
        });
    }

    // Apply AND operations
    if (andSets.length > 0) {
        andSets.forEach(set => {
            currentSet = new Set([...currentSet].filter(x => set.has(x)));
        });
    }

    // Apply NOT operations
    if (notSets.length > 0) {
        notSets.forEach(set => {
            currentSet = new Set([...currentSet].filter(x => !set.has(x)));
        });
    }

    // Update active neurons and labels based on the filtered result
    activeUnits = Array.from(currentSet);
    activeUnitLabels = {};
    activeUnits.forEach(neuronId => {
        activeUnitLabels[neuronId] = neuronLabels[neuronId];
    });

    // Recreate the tags dictionary based on the filtered neurons
    createTagsDictionary();

    // Reset the current neuron to the first in the filtered list
    if (activeUnits.length > 0) {
        currentUnitId = activeUnits[0];
        currentUnitIndex = 0;
        displayCurrentUnit();
    } else {
        // Handle the case where no neurons match the search
        currentUnitId = null;
        document.getElementById('neuronIdDisplay').textContent = 'No Unit Selected';
        document.getElementById('neuronTagDisplay').textContent = '';
    }
}

function validateSearchString(queries) {
    // Ensure the number of elements is even and that logical operators are in the correct places
    if (queries.length % 2 !== 0) {
        return false; // Should be an even number of elements after adjustments
    }

    for (let i = 0; i < queries.length; i += 2) {
        if (!['&', '|', '!'].includes(queries[i])) {
            return false; // Logical operators must be in the first, third, fifth, etc. positions
        }
    }
    return true;
}

function applyQuery(set, operator, query) {
    const querySet = getQuerySet(query);
    if (operator === '&') {
        return new Set([...set].filter(x => querySet.has(x)));
    } else if (operator === '|') {
        return new Set([...set, ...querySet]);
    } else if (operator === '!') {
        return new Set([...set].filter(x => !querySet.has(x)));
    }
    return set; // Default, should not reach here
}

function getQuerySet(query) {
    let querySet = new Set();

    // Check if the query is enclosed in single or double quotes for neuron IDs
    if ((query.startsWith('"') && query.endsWith('"')) || (query.startsWith("'") && query.endsWith("'"))) {
        const neuronId = query.slice(1, -1); // Remove the quotation marks
        querySet = new Set(Object.keys(neuronLabels).filter(neuron => neuron.includes(neuronId)));
    } else {
        // Treat as a tag by default
        if (tagsDictionary[query]) {
            querySet = new Set(tagsDictionary[query]);
        }
    }

    return querySet;
}

function switchToNextUnit() {
    if (activeUnits.length > 0) {
        currentUnitIndex = (currentUnitIndex + 1) % activeUnits.length;
        currentUnitId = activeUnits[currentUnitIndex];
        displayCurrentUnit();
    }
}

function switchToPreviousUnit() {
    if (activeUnits.length > 0) {
        currentUnitIndex = (currentUnitIndex - 1 + activeUnits.length) % activeUnits.length;
        currentUnitId = activeUnits[currentUnitIndex];
        displayCurrentUnit();
    }
}

function handleKeyDown(event) {
    // Check if either Ctrl (Windows/Linux) or Cmd (Mac) is pressed along with the arrow keys
    if ((event.ctrlKey) && event.key === '2') {
        switchToNextUnit(); // Move to the next neuron
    } else if ((event.ctrlKey) && event.key === '1') {
        switchToPreviousUnit(); // Move to the previous neuron
    }
}

// New functions to add and remove tags
function addTag() {
    const tagInput = document.getElementById('searchBox').value.trim();
    if (tagInput && currentUnitId) {
        // Update both activeUnitLabels and neuronLabels
        const activeTags = activeUnitLabels[currentUnitId] || [];
        const allTags = neuronLabels[currentUnitId] || [];

        // Check if the tag already exists
        if (!allTags.includes(tagInput)) {
            allTags.push(tagInput);
            neuronLabels[currentUnitId] = allTags; // Update the full dataset

            if (activeTags !== allTags) { // Only update active if they are different
                activeTags.push(tagInput);
                activeUnitLabels[currentUnitId] = activeTags; // Update the active dataset
            }

            updateJSON(); // Update changes to the server or local storage
            createTagsDictionary(); // Rebuild tags dictionary to reflect changes
            displayCurrentUnit(); // Update the UI to reflect changes
        }
    }
}

function removeTagOrNote() {
    const input = document.getElementById('searchBox').value.trim();

    if (!input || !currentUnitId) {
        console.error("No input or currentUnitId is missing.");
        return;  // Do nothing if the input is empty or no unit is selected
    }
    if (input.startsWith('%')) {
        // Handling note removal
        removeNote(input);
    } else {
        // Handling tag removal
        removeTag(input);
    }
}

function removeTag(tagInput) {

    // Update both activeUnitLabels and neuronLabels
    const activeTags = activeUnitLabels[currentUnitId] || [];
    const allTags = neuronLabels[currentUnitId] || [];
    
    // Check if the tag exists and remove it
    const indexInAllTags = allTags.indexOf(tagInput);
    if (indexInAllTags > -1) {
        allTags.splice(indexInAllTags, 1); // Remove tag from full dataset
        neuronLabels[currentUnitId] = allTags;

        const indexInActiveTags = activeTags.indexOf(tagInput);
        if (indexInActiveTags > -1) {
            activeTags.splice(indexInActiveTags, 1); // Remove tag from active dataset
            activeUnitLabels[currentUnitId] = activeTags;
        }

        updateJSON(); // Synchronize changes to the JSON file
        createTagsDictionary(); // Rebuild tags dictionary to reflect changes
        displayCurrentUnit(); // Update the UI to reflect changes
    }
}


function removeNote(input) {
    const noteIndex = parseInt(input.substring(1).trim()) - 1; // Convert input like '%#2' to index 1
    if (isNaN(noteIndex)) {
        console.error("Invalid note index specified.");
        return; // Exit if no valid index is provided
    }

    // Get the mixed list of tags and notes
    const entries = neuronLabels[currentUnitId] || [];
    let noteContent = "";
    let noteActualIndex = -1;
    let noteCounter = 0;

    // Find the exact note to remove by iterating over entries and counting notes
    for (let i = 0; i < entries.length; i++) {
        if (entries[i].startsWith('%')) {
            if (noteCounter === noteIndex) {
                noteContent = entries[i];
                noteActualIndex = i;
                break;
            }
            noteCounter++;
        }
    }

    if (noteActualIndex !== -1) {
        // Remove the note from the array
        entries.splice(noteActualIndex, 1);
        neuronLabels[currentUnitId] = entries; // Update the main data structure

        updateJSON(); // Synchronize changes to the JSON file
        displayCurrentUnit(); // Update the UI to reflect changes
        console.log("Note removed:", noteContent);
    } else {
        console.error("Note not found or note index out of range.");
    }
}


function updateActiveUnitLabels() {
    activeUnitLabels = { ...neuronLabels };
    createTagsDictionary();
}

function updateJSON() {
    console.log('Sending updated data to server:', JSON.stringify(neuronLabels, null, 2)); // Log the data being sent

    fetch('http://localhost:2024/update_units_tags', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            fileName: currentTagFile, // Include the current tag file name in the request
            data: neuronLabels // Send the actual data to be updated
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                throw new Error(`Failed to update JSON file on the server. Status: ${response.status}, Message: ${text}`);
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('JSON file updated successfully:', data);
    })
    .catch(error => {
        console.error('Error updating JSON file:', error);
    });
}

function adjustImageScale(value) {
    // Apply a logarithmic mapping based on the slider's value
    if (value <= 0.5) {
        sliderScale = Math.pow(2, (value - 0.5) * 4); // Scale down for values < 0.5
    } else {
        sliderScale = Math.pow(2, (value - 0.5) * 4); // Scale up for values >= 0.5
    }

    actualScaleFactor = scaleFactor * sliderScale; // Update the actual scale factor

    // Update the scale value display
    document.getElementById('scaleValue').textContent = sliderScale.toFixed(2);

    // Apply the actual scale factor to all images
    const images = document.querySelectorAll('.scalable-image');
    images.forEach(img => {
        img.style.width = `${img.naturalWidth * actualScaleFactor}px`;
        img.style.height = `${img.naturalHeight * actualScaleFactor}px`;
    });
}

function displayUnitImages(neuronId) {
    const imageContainer = document.getElementById('image-container');
    imageContainer.innerHTML = ''; // Clear the container

    fetch(`/units_figures/${neuronId}`)
        .then(response => response.json())
        .then(imageList => {
            if (imageList.length === 0 && firstRun) {
                // No images in the first neuron, set scaleFactor to 0.5
                scaleFactor = scaleFactorDefault;
                actualScaleFactor = scaleFactor * sliderScale;
                firstRun = false; // Ensure this logic only runs on the first display
                return; // No need to load images
            }

            let maxHeight = 0;

            // Find the maximum height among the images
            const loadPromises = imageList.map(imageName => {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.src = `/units_figures/${neuronId}/${imageName}`;
                    img.alt = imageName;

                    img.onload = function () {
                        maxHeight = Math.max(maxHeight, img.naturalHeight);
                        resolve(img);
                    };

                    img.onerror = reject; // Handle image load errors
                });
            });

            // Once all images are loaded, calculate the scaleFactor and display images
            Promise.all(loadPromises).then(images => {
                if (firstRun) {
                    const imageContainerHeight = imageContainer.clientHeight; // Get the height of the container without scrolling
                    scaleFactor = (imageContainerHeight / maxHeight) * scaleFactorExtra;
                    actualScaleFactor = scaleFactor * sliderScale;
                    firstRun = false; // Ensure this logic only runs on the first display
                }

                images.forEach(img => {
                    img.classList.add('scalable-image');
                    img.style.width = `${img.naturalWidth * actualScaleFactor}px`;
                    img.style.height = `${img.naturalHeight * actualScaleFactor}px`;

                    const wrapper = document.createElement('div');
                    wrapper.classList.add('image-wrapper');
                    wrapper.appendChild(img);
                    imageContainer.appendChild(wrapper);
                });
            }).catch(error => {
                console.error('Error loading images:', error);
            });
        })
        .catch(error => {
            console.error('Error fetching image list:', error);
        });
}

function remapScale() {
    const imageContainer = document.getElementById('image-container');
    const images = document.querySelectorAll('.scalable-image');

    if (images.length === 0) {
        // No images found, reset to default scaleFactor
        scaleFactor = scaleFactorDefault;
    } else {
        // Calculate the maximum height among the current images
        let maxHeight = 0;
        images.forEach(img => {
            maxHeight = Math.max(maxHeight, img.naturalHeight);
        });

        const imageContainerHeight = imageContainer.clientHeight; // Height without scrolling
        scaleFactor = (imageContainerHeight / maxHeight) * scaleFactorExtra;
    }

    // Reset the slider scale to 1
    sliderScale = 1.0;
    actualScaleFactor = scaleFactor * sliderScale; // Recalculate the actual scale factor

    // Update the slider UI
    document.getElementById('scaleSlider').value = 0.5; // Reset slider to middle
    document.getElementById('scaleValue').textContent = sliderScale.toFixed(2);

    // Apply the new scaling to all images
    images.forEach(img => {
        img.style.width = `${img.naturalWidth * actualScaleFactor}px`;
        img.style.height = `${img.naturalHeight * actualScaleFactor}px`;
    });
}


function applyTracking() {
    const inputBox = document.getElementById('searchBox');
    const inputText = inputBox.value;
    trackingTags = inputText.split(',').map(tag => tag.trim());

    displayCurrentUnit(); // Update the display to apply the tracking styles
}

function displayCurrentUnit() {
    const neuronIdDisplay = document.getElementById('neuronIdDisplay');
    const neuronTagDisplay = document.getElementById('neuronTagDisplay');
    const neuronNoteDisplay = document.getElementById('neuronNoteDisplay'); // Element for displaying notes

    document.getElementById('tagFileDropdown').value = currentTagFile;

    if (currentUnitId) {
        const indexInfo = `(${currentUnitIndex + 1}/${activeUnits.length})`;
        neuronIdDisplay.textContent = `${currentUnitId} ${indexInfo}`;

        const currentTagsAndNotes = neuronLabels[currentUnitId] || [];
        const sortedTags = Object.keys(tagOccurrences).sort((a, b) => tagOccurrences[b] - tagOccurrences[a]);

        // Display all tags, highlight current tags and apply tracking style
        const tags = sortedTags.map(tag => {
            const tagDisplay = `${tag} *${tagOccurrences[tag]}`;
            let tagClass = currentTagsAndNotes.includes(tag) ? 'highlighted-tag' : 'default-tag';
            if (trackingTags.includes(tag)) {
                tagClass += ' tracking-tag'; // Add the tracking-tag class for underline
            }
            return `<span class="${tagClass}">${tagDisplay}</span>`;
        }).filter(tag => tag); // Remove undefined entries (from notes)

        neuronTagDisplay.innerHTML = tags.join(' ');

        // Independently process and display notes
        notes = currentTagsAndNotes.filter(tag => tag.startsWith('%')).map(note => note.substring(1)); // Remove '%' and add to notes array
        const neuronNoteDisplay = document.getElementById('neuronNoteDisplay');
        neuronNoteDisplay.innerHTML = notes.length ? `${notes.map(note => `<li>${note}</li>`).join('')}` : 'No notes available';

        displayUnitImages(currentUnitId);
    } else {
        neuronIdDisplay.textContent = 'No Unit Selected';
        neuronTagDisplay.textContent = '';
        neuronNoteDisplay.textContent = ''; // Clear the notes display
        document.getElementById('image-container').innerHTML = ''; // Clear the image container if no neuron is selected
    }
}


function appendAllFolderNamesToNeuronLabels() {
    let updated = false;
    allFolderNames.forEach(folderName => {
        if (!neuronLabels[folderName]) {
            neuronLabels[folderName] = [];  // Initialize with an empty list if not exist
            updated = true;
        }
    });

    console.log('All Folder Names:', allFolderNames);

    if (updated) {
        updateJSON();  // Use existing function to update the server
        window.location.reload();// refresh the window
    }
}

function createFile(fileName) {
    const fullFileName = fileName + '.json';
    fetch('/create-file', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fileName: fullFileName })
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                throw new Error(`Failed to create file on the server. Status: ${response.status}, Message: ${text}`);
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('File created:', data);
        updateLastUsedTagFile(fullFileName);  // Update the log file with the new file name
    })
    .then(() => {
        window.location.reload();  // Reload the page to reflect the new file
    })
    .catch(error => {
        console.error('Error creating file:', error);
    });
}
