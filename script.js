document.addEventListener('DOMContentLoaded', async () => {
    // await getCurrentPaths();
    initializeApp();

    // EVENT LISTENERS
    // resizer between the control panel and the image container
    const resizer = document.getElementById('resizer');
    const controlPanel = document.getElementById('control-panel');
    const imageContainer = document.getElementById('image-container');
    let startX, startWidth, initialOffset;

    resizer.addEventListener('mousedown', function(e) {
        e.preventDefault();
        startX = e.clientX;
        startWidth = parseInt(document.defaultView.getComputedStyle(controlPanel).width, 10);
        initialOffset = startX - controlPanel.getBoundingClientRect().right;

        document.addEventListener('mousemove', resizePanel);
        document.addEventListener('mouseup', stopResize);
    });

    function resizePanel(e) {
        const newWidth = startWidth + (startX - e.clientX) - initialOffset;

        if (newWidth > 300) {
            controlPanel.style.width = `${newWidth}px`;
            imageContainer.style.width = `calc(100% - ${newWidth}px)`;
        }
    }

    function stopResize() {
        document.removeEventListener('mousemove', resizePanel);
        document.removeEventListener('mouseup', stopResize);
    }

    // Initialize current tag file and set up key event listeners
    document.addEventListener('keydown', handleKeyDown);

    // Set up search box functionality
    const searchBox = document.getElementById('searchBox');
    searchBox.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            applySearch();
        }
    });

    // Set up units path link (folder selection by clicking)
    const unitsPathLink = document.getElementById('unitsPathLink');
    unitsPathLink.addEventListener('click', async (event) => {
        event.preventDefault();
        await selectFolder();
    });

    // Get initial path
    fetch('/get-current-units-path')
        .then(response => response.json())
        .then(data => {
            currentUnitsPath = data.displayPath;
            updateUnitsPathLink();
        })
        .catch(error => console.error('Error getting initial path:', error));

    // Populate dropdown and fetch folder names
    populateDropdown();
    fetch('/list-folder-names')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch folder names');
            }
            return response.json();
        })
        .then(folderNames => {
            // console.log('Received folder names:', folderNames);
            allFolderNames = folderNames;
        })
        .catch(error => {
            console.error('Error fetching folder names:', error);
        });

    // Set up FillAll functionality
    document.getElementById('fillButton').addEventListener('click', function() {
        document.getElementById('fillModal').style.display = 'block';
        document.getElementById('tagFileName').textContent = currentTagFile;
    });

    document.getElementById('confirmFill').addEventListener('click', function() {
        appendAllFolderNamesToNeuronLabels();
        document.getElementById('fillModal').style.display = 'none';
    });

    document.getElementById('cancelFill').addEventListener('click', function() {
        document.getElementById('fillModal').style.display = 'none';
    });
    // end of FillAll functionality

    // Set up NewJS functionality
    document.getElementById('newButton').addEventListener('click', function() {
        document.getElementById('overlay').style.display = 'block';
        document.getElementById('newFileModal').style.display = 'block';
    });

    document.getElementById('confirmButton').addEventListener('click', function() {
        const newFileName = document.getElementById('fileName').value;
        createFile(newFileName);
        document.getElementById('overlay').style.display = 'none';
        document.getElementById('newFileModal').style.display = 'none';
    });

    document.getElementById('cancelNewButton').addEventListener('click', function() {
        document.getElementById('overlay').style.display = 'none';
        document.getElementById('newFileModal').style.display = 'none';
    });
    // end of NewJS functionality

    // monitor tag file dropdown functionality
    const tagFileDropdown = document.getElementById('tagFileDropdown');
    tagFileDropdown.addEventListener('change', function() {
        const selectedTagFile = this.value;
        if (selectedTagFile !== currentTagFile) {
            currentTagFile = selectedTagFile;
            record.lastUsedTagFile = currentTagFile;
            updateLogRecord();

            // if it exists, try to load the setup: the trackingTags and searchText
            console.log('New tag file loaded:', currentTagFile);  // Optional: log the loaded file for debugging

            fetchUnitLabels();

            loadAndApplySetup();
        }
    });
});


// function to load setup from the record
function loadAndApplySetup() {
    //load setup from the record
    if (record.setups && record.setups[currentTagFile]) {
        const setup = record.setups[currentTagFile];
        console.log('existing setup:', setup);

        if (setup.searchText) {
            updateCurrentQueryDisplay(setup.searchText);
            //print 
            console.log('searchText:', setup.searchText);
            applySearch(setup.searchText);
        }
        if (setup.trackingTags) {
            applyTracking(setup.trackingTags);
        }
    }
    else {
        console.log('no setup found for', currentTagFile);
        record.setups[currentTagFile] = {};
    }
}





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
let currentTagFile = ''; // Global variable
let allFolderNames = [];
let notes = [];
let trackingTags = [];
let currentUnitsPath;
let record = {};
let tagsPath;
let currentColumns = 3; // Default to 3 columns
let masonryInstance = null;



async function initializeCurrentPath() {
    try {
        const response = await fetch('/last-used-data');
        const data = await response.json();
        
        if (data.lastUsedUnitsPath && data.records && data.records[data.lastUsedUnitsPath]) {
            currentUnitsPath = data.lastUsedUnitsPath;
            record = data.records[currentUnitsPath]; // update global variable
            console.log('current units path:', currentUnitsPath);
        } else {
            console.log('records:', data.records);
            console.log('no last used units path');
            currentUnitsPath = null;
            record = {}; // clear global variable
        }
        
        updateUnitsPathLink(); // Update the UI to reflect the current path
    } catch (error) {
        console.error('error initializing current path:', error);
    }
}

async function initializeCurrentTagFile() {
    try {
        if (record && record.lastUsedTagFile) {
            currentTagFile = record.lastUsedTagFile;
            console.log('current tag file:', currentTagFile);
            await fetchUnitLabels();
        } else {
            console.log('no last used tag file');
            currentTagFile = null;
            neuronLabels = {};
            activeUnits = [];
        }
        
        await populateDropdown();
        displayCurrentUnit();
    } catch (error) {
        console.error('error initializing current tag file:', error);
    }
}

async function initializeTrackingTags() {
    if (record && record.setups && record.setups[currentTagFile] && record.setups[currentTagFile].trackingTags) {
        trackingTagText = record.setups[currentTagFile].trackingTags;
        // print trackingTagText
        console.log('trackingTagText:', trackingTagText);
        applyTracking(trackingTagText);
    }
}

async function initializeQuery() {
    if (record && record.setups && record.setups[currentTagFile] && record.setups[currentTagFile].queryText) {
        queryText = record.setups[currentTagFile].queryText;

        // put the queryText into the search box
        const searchBox = document.getElementById('searchBox');
        searchBox.value = queryText;
        applySearchByInputBox();

        // print queryText
        console.log('queryText:', queryText);
    }
}


// Add this function to display an empty state
function displayEmptyState() {
    const neuronIdDisplay = document.getElementById('neuronIdDisplay');
    const neuronTagDisplay = document.getElementById('neuronTagDisplay');
    const neuronNoteDisplay = document.getElementById('neuronNoteDisplay');
    const imageContainer = document.getElementById('image-container');

    neuronIdDisplay.textContent = 'No Unit Selected';
    neuronTagDisplay.textContent = '';
    neuronNoteDisplay.textContent = '';
    imageContainer.innerHTML = '';
}

async function initializeApp() {
    try {
        await initializeCurrentPath();
        await initializeCurrentTagFile();
        await initializeTrackingTags();
        await initializeQuery();

        if (activeUnits.length > 0) {
            currentUnitId = activeUnits[0];
            currentUnitIndex = 0;
            displayCurrentUnit();
        } else {
            console.log('No units available to display');
            displayEmptyState();
        }

        updateUnitsPathLink();
        updateCurrentQueryDisplay('');
    } catch (error) {
        console.error('Error during initialization:', error);
        displayEmptyState();
    }
}

// update the units path link, detail:
// 1. update the link text to the current units path
// 2. update the global variable currentUnitsPath
function updateUnitsPathLink() {
    const link = document.getElementById('unitsPathLink');
    link.textContent = currentUnitsPath || 'Select Path';
}

function getInitialPath() {
    fetch('/get-current-units-path')
        .then(response => response.json())
        .then(data => {
            currentUnitsPath = data.displayPath;
            updateUnitsPathLink();
        })
        .catch(error => console.error('Error getting initial path:', error));
}

function handleKeyDown(event) {
    // Check if either Ctrl (Windows/Linux) or Cmd (Mac) is pressed along with the arrow keys
    if ((event.ctrlKey) && event.key === '2') {
        switchToNextUnit(); // Move to the next neuron
    } else if ((event.ctrlKey) && event.key === '1') {
        switchToPreviousUnit(); // Move to the previous neuron
    }
}

async function getCurrentPaths() {
    try {
        const response = await fetch('/current-paths');
        const data = await response.json();
        if (response.ok) {
            currentUnitsPath = data.unitsPath;
            tagsPath = data.tagsPath;
            // Instead of calling updatePathsDisplay, let's update the UI directly
            updateUnitsPathLink();
            console.log('Paths updated:', { currentUnitsPath, tagsPath });
        } else {
            console.error('Paths not initialized:', data.error);
            // Handle the error in the UI, maybe prompt the user to set a path
        }
    } catch (error) {
        console.error('Error fetching current paths:', error);
    }
}


function listFolderNames() {
    const fs = require('fs');
    const path = require('path');
    const figuresPath = path.join(__dirname, 'units');

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


function populateDropdown() {
    fetch('/json-files')
        .then(response => response.json())
        .then(files => {
            const dropdown = document.getElementById('tagFileDropdown');
            dropdown.innerHTML = '';  // Clear existing options
            if (files.length === 0) {
                const option = document.createElement('option');
                option.text = 'No tag files available';
                dropdown.appendChild(option);
                dropdown.disabled = true;
            } else {
                files.forEach(file => {
                    const option = document.createElement('option');
                    option.value = file;
                    option.text = file;
                    dropdown.appendChild(option);
                });
                dropdown.disabled = false;
            }
            dropdown.value = currentTagFile || '';
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

async function fetchUnitLabels() {
    try {
        const response = await fetch(`/units/${currentTagFile}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (typeof data === 'object' && !Array.isArray(data)) {
            neuronLabels = data;
            console.log('Unit Labels Loaded:', neuronLabels);
        } else {
            throw new Error('Invalid data format received');
        }
        
        // Set activeUnits to be only the neuron IDs from the tag file
        activeUnits = Object.keys(neuronLabels);
        
        createTagsDictionary();
        if (activeUnits.length > 0) {
            currentUnitId = activeUnits[0];
            currentUnitIndex = 0;
            displayCurrentUnit();
        } else {
            console.log('No units available in the selected tag file.');
            displayEmptyState();
        }
    } catch (error) {
        console.error('Error fetching neuron labels:', error);
        // alert(`Error loading neuron labels: ${error.message}`);
        displayEmptyState();
    }
}

function displayEmptyState() {
    currentUnitId = null;
    currentUnitIndex = -1;
    document.getElementById('neuronIdDisplay').textContent = 'No units available';
    document.getElementById('neuronTagDisplay').textContent = '';
    document.getElementById('neuronNoteDisplay').textContent = '';
    document.getElementById('image-container').innerHTML = '';
}

function resetActiveUnits() {
    activeUnitLabels = { ...neuronLabels }; // Clone the original neuron labels
    activeUnits = Object.keys(neuronLabels); // Clone the neuron IDs array
    createTagsDictionary(); // Ensure the tags dictionary is created for full dataset
}

function createTagsDictionary() {
    tagsDictionary = {}; // Reset the dictionary
    tagOccurrences = {}; // Reset the tag occurrences dictionary

    for (const neuronId of Object.keys(neuronLabels)) {
        const labels = neuronLabels[neuronId];
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


function applySearchByInputBox() {
    const searchBox = document.getElementById('searchBox');
    let searchText = searchBox.value;
    applySearch(searchText);
}

function applySearch(searchText) {
    // Store the original search text for later use in highlighting
    window.lastSearchText = searchText;

    // Update the current query display
    updateCurrentQueryDisplay(searchText);

    // Parse the query
    const queries = parseQuery(searchText);

    // Check if the searchText is empty after stripping out space
    if (queries.length === 0) {
        // If the search box is empty, use the full set
        activeUnits = Object.keys(neuronLabels);
        activeUnitLabels = { ...neuronLabels };
        createTagsDictionary();
        currentUnitId = activeUnits[0];
        currentUnitIndex = 0;
        displayCurrentUnit();
        return;
    }

    // Check the first element and adjust if necessary
    if (!['&&', '++', '^^'].includes(queries[0])) {
        queries.unshift('&&');
    } else if (queries[0] === '++') {
        queries[0] = '&&';
    }

    // Validate the search string
    if (!validateSearchString(queries)) {
        alert('Invalid search format!');
        return;
    }

    // Apply the queries
    let currentSet = new Set(Object.keys(neuronLabels));
    for (let i = 0; i < queries.length; i += 2) {
        const operator = queries[i];
        const query = queries[i + 1].trim(); // Trim each sub-query
        currentSet = applyQuery(currentSet, operator, query);
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

function parseQuery(queryString) {
    // Replace keywords with symbols
    queryString = queryString.replace(/#and#/gi, '&&');
    queryString = queryString.replace(/#or#/gi, '++');
    queryString = queryString.replace(/#not#/gi, '^^');

    // Split the query string, preserving spaces within quotes and after '%'
    const regex = /(\&\&|\+\+|\^\^)|("[^"]*")|('[^']*')|(%[^&+^]+)/g;
    const tokens = [];
    let lastIndex = 0;

    queryString.replace(regex, (match, operator, doubleQuoted, singleQuoted, noteSearch, offset) => {
        if (offset > lastIndex) {
            tokens.push(queryString.slice(lastIndex, offset));
        }
        tokens.push(match);
        lastIndex = offset + match.length;
    });

    if (lastIndex < queryString.length) {
        tokens.push(queryString.slice(lastIndex));
    }

    return tokens.filter(token => token.trim() !== '');
}


function getQuerySet(query) {
    query = query.trim();
    if (query.startsWith('%')) {
        // Search in notes
        const searchString = query.slice(1).toLowerCase();
        return new Set(Object.keys(neuronLabels).filter(neuronId => {
            const notes = neuronLabels[neuronId].filter(tag => tag.startsWith('%'));
            return notes.some(note => note.toLowerCase().includes(searchString));
        }));
    } else if ((query.startsWith('"') && query.endsWith('"')) || (query.startsWith("'") && query.endsWith("'"))) {
        // Search for ID
        const searchString = query.slice(1, -1).toLowerCase();
        return new Set(Object.keys(neuronLabels).filter(neuronId => 
            neuronId.toLowerCase().includes(searchString)
        ));
    } else {
        // Treat as a tag
        return new Set(tagsDictionary[query] || []);
    }
}

function applyQuery(set, operator, query) {
    const querySet = getQuerySet(query);
    switch (operator) {
        case '&&':
            return new Set([...set].filter(x => querySet.has(x)));
        case '++':
            return new Set([...set, ...querySet]);
        case '^^':
            return new Set([...set].filter(x => !querySet.has(x)));
        default:
            return set;
    }
}

function validateSearchString(queries) {
    if (queries.length % 2 !== 0) {
        return false; // Should be an even number of elements after adjustments
    }

    for (let i = 0; i < queries.length; i += 2) {
        if (!['&&', '++', '^^'].includes(queries[i])) {
            return false; // Logical operators must be in the first, third, fifth, etc. positions
        }
    }
    return true;
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
    // console.log('Sending updated data to server:', JSON.stringify(neuronLabels, null, 2)); // Log the data being sent

    fetch('/update_units_tags', {
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

    applySimpleMasonry();
}

async function loadImages() {
    try {
        const currentNeuronId = getCurrentNeuronId();
        const response = await fetch(`/units/${currentNeuronId}`);
        if (!response.ok) {
            if (response.status === 404) {
                return { exists: false, images: [] }; // Folder doesn't exist
            }
            throw new Error('Failed to fetch images');
        }
        const data = await response.json();
        return { exists: true, images: data.images };
    } catch (error) {
        console.error('Error loading images:', error);
        return { exists: true, images: [] }; // Assume folder exists but there's an error
    }
}

function adjustColumns(value) {
    currentColumns = parseInt(value);
    console.log(`Adjusting columns to ${currentColumns}`);
    document.getElementById('columnValue').textContent = `${currentColumns} col.${currentColumns > 1 ? 's' : ''}`;
    
    const masonryItems = document.querySelectorAll('.masonry-item');
    masonryItems.forEach((item) => {
        item.style.width = `calc(${100 / currentColumns}% - 1px)`;
    });

    initializeMasonry();
}

function initializeMasonry() {
    const grid = document.querySelector('.grid');
    if (!grid) return; // Exit if the grid element doesn't exist

    if (masonryInstance) {
        masonryInstance.destroy(); // Destroy existing instance if it exists
    }

    masonryInstance = new Masonry(grid, {
        itemSelector: '.grid-item',
        columnWidth: '.grid-sizer',
        percentPosition: true
    });
}

function displayImages(imageFiles, neuronId) {
    console.log(`Displaying images for neuron ${neuronId}, currentColumns: ${currentColumns}`);
    const imageContainer = document.getElementById('image-container');
    imageContainer.innerHTML = ''; // Clear existing images

    const masonryWrapper = document.createElement('div');
    masonryWrapper.className = 'masonry-wrapper';
    imageContainer.appendChild(masonryWrapper);

    const promises = imageFiles.map((file, index) => {
        return new Promise((resolve) => {
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'masonry-item';
            imgWrapper.style.width = `calc(${100 / currentColumns}% - 1px)`;

            const fileExtension = file.split('.').pop().toLowerCase();

            if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff'].includes(fileExtension)) {
                // Handle standard image formats
                const img = new Image();
                img.src = `/units/${neuronId}/${file}`;
                img.alt = file;
                img.className = 'scalable-image';
                img.onload = resolve;
                imgWrapper.appendChild(img);
            } else if (fileExtension === 'svg') {
                // Handle SVG files
                fetch(`/units/${neuronId}/${file}`)
                    .then(response => response.text())
                    .then(svgContent => {
                        imgWrapper.innerHTML = svgContent;
                        const svgElement = imgWrapper.querySelector('svg');
                        svgElement.setAttribute('width', '100%');
                        svgElement.setAttribute('height', 'auto');
                        svgElement.classList.add('scalable-image');
                        resolve();
                    });
            } else if (fileExtension === 'pdf') {
                // Handle PDF files
                const canvas = document.createElement('canvas');
                canvas.className = 'scalable-image';
                imgWrapper.appendChild(canvas);

                pdfjsLib.getDocument(`/units/${neuronId}/${file}`).promise.then(pdf => {
                    pdf.getPage(1).then(page => {
                        const scale = 1.5;
                        const viewport = page.getViewport({ scale: scale });
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        const renderContext = {
                            canvasContext: canvas.getContext('2d'),
                            viewport: viewport
                        };
                        page.render(renderContext).promise.then(() => {
                            resolve();
                        });
                    });
                });
            } else if (fileExtension === 'eps') {
                // For EPS files, display a placeholder or icon
                const placeholder = document.createElement('div');
                placeholder.className = 'file-placeholder scalable-image';
                placeholder.textContent = 'EPS File';
                imgWrapper.appendChild(placeholder);
                resolve();
            }

            masonryWrapper.appendChild(imgWrapper);
            console.log(`Added image ${index + 1}, width: ${imgWrapper.style.width}`);
        });
    });

    // Wait for all images to load before initializing Masonry
    Promise.all(promises).then(() => {
        console.log(`All images loaded, total: ${imageFiles.length}`);
        initializeMasonry();
    });
}

// Event listener for the new column slider
document.getElementById('columnSlider').addEventListener('input', function() {
    adjustColumns(this.value);
});

// Initialize the column layout on page load
document.addEventListener('DOMContentLoaded', function() {
    adjustColumns(currentColumns); // Start with 3 columns
    
    // If images are already loaded, apply the layout
    const masonryWrapper = document.querySelector('.masonry-wrapper');
    if (masonryWrapper) {
        if (typeof imagesLoaded === 'function') {
            imagesLoaded(masonryWrapper, function() {
                applyMasonryLayout();
            });
        } else {
            applyMasonryLayout();
        }
    }
});

// Reapply layout on window resize
window.addEventListener('resize', () => adjustColumns(document.getElementById('columnSlider').value));


function applyMasonryLayout() {
    const masonryWrapper = document.querySelector('.masonry-wrapper');
    if (masonryWrapper) {
        // Force a reflow
        masonryWrapper.offsetHeight;

        new Masonry(masonryWrapper, {
            itemSelector: '.masonry-item',
            columnWidth: `.masonry-item`,
            percentPosition: true,
            gutter: 1, // Add a small gutter
            fitWidth: true, // This helps with centering the layout
            transitionDuration: '0.2s'
        });
    }
}

function initMasonry() {
    const masonryWrapper = document.querySelector('.masonry-wrapper');
    new Masonry(masonryWrapper, {
        itemSelector: '.masonry-item',
        columnWidth: '.masonry-item',
        percentPosition: true,
        transitionDuration: 0
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

    initMasonry();
}

// if nothing is given to this function, generate trackingTags from the inputBox, otherwise, directly use the trackingTags
function applyTrackingByInputBox() {
    const inputBox = document.getElementById('searchBox');
    const inputText = inputBox.value;
    applyTracking(inputText);
}

function applyTracking(inputText) {
    trackingTags = inputText.split(',').map(tag => tag.trim()).filter(tag => tag !== '');

    // save the inputText to the setup
    record.setups[currentTagFile].trackingTags = inputText;

    updateLogRecord();

    displayCurrentUnit(); // Update the display to apply the tracking styles
}

async function displayCurrentUnit() {
    if (!currentUnitId || activeUnits.length === 0) {
        displayEmptyState();
        return;
    }

    const neuronIdDisplay = document.getElementById('neuronIdDisplay');
    const neuronTagDisplay = document.getElementById('neuronTagDisplay');
    const neuronNoteDisplay = document.getElementById('neuronNoteDisplay');
    const imageContainer = document.getElementById('image-container');

    document.getElementById('tagFileDropdown').value = currentTagFile || '';

    if (currentUnitId && activeUnits.length > 0) {
        const indexInfo = `(${currentUnitIndex + 1}/${activeUnits.length})`;
        
        // Load images and check folder status
        const { exists, images } = await loadImages();
        
        // Highlight matched parts in the unit ID
        const highlightedId = highlightMatchedText(currentUnitId, window.lastSearchText, 'highlight-id');
        
        // Set the neuron ID display with appropriate styling and highlighting
        if (exists && images.length > 0) {
            neuronIdDisplay.innerHTML = `${highlightedId} ${indexInfo}`;
            neuronIdDisplay.style.color = ''; // Reset to default color
            neuronIdDisplay.style.textDecoration = 'none';
        } else if (exists && images.length === 0) {
            neuronIdDisplay.innerHTML = `${highlightedId} ${indexInfo}: img?`;
            neuronIdDisplay.style.color = 'gray';
            neuronIdDisplay.style.textDecoration = 'none';
        } else {
            neuronIdDisplay.innerHTML = `${highlightedId} ${indexInfo}: folder?`;
            neuronIdDisplay.style.color = 'gray';
            neuronIdDisplay.style.textDecoration = 'line-through';  // Add this line to cross out the text
        }

        const currentTagsAndNotes = neuronLabels[currentUnitId] || [];
        const sortedTags = Object.keys(tagOccurrences).sort((a, b) => tagOccurrences[b] - tagOccurrences[a]);

        // Display all tags, highlight current tags and apply tracking style
        const tags = sortedTags.map(tag => {
            if (tag.startsWith('%')) return ''; // Skip notes
            const tagDisplay = `${tag} *${tagOccurrences[tag]}`;
            let tagClass = currentTagsAndNotes.includes(tag) ? 'highlighted-tag' : 'default-tag';
            if (trackingTags.includes(tag)) {
                tagClass += ' tracking-tag';
                if (currentTagsAndNotes.includes(tag)) {
                    tagClass += ' tracked-and-present';
                }
            }
            return `<span class="${tagClass}">${tagDisplay}</span>`;
        }).filter(tag => tag);

        neuronTagDisplay.innerHTML = tags.join(' ');

        // Display notes with highlighting
        const notes = currentTagsAndNotes.filter(tag => tag.startsWith('%')).map(note => note.substring(1));
        const highlightedNotes = notes.map(note => highlightMatchedText(note, window.lastSearchText, 'highlight-note'));
        neuronNoteDisplay.innerHTML = notes.length ? 
            `${highlightedNotes.map(note => `<li>${note}</li>`).join('')}` : 
            'No notes available';

        // Display images or clear the container
        if (exists && images.length > 0) {
            displayImages(images, currentUnitId);
        } else {
            imageContainer.innerHTML = ''; // Clear the image container
        }
    } else {
        neuronIdDisplay.textContent = 'No Unit Selected';
        neuronIdDisplay.style.color = ''; // Reset to default color
        neuronTagDisplay.textContent = '';
        neuronNoteDisplay.textContent = '';
        imageContainer.innerHTML = '';

        // If there are units but none is selected, select the first one
        if (activeUnits.length > 0) {
            currentUnitId = activeUnits[0];
            currentUnitIndex = 0;
            displayCurrentUnit(); // Recursive call to display the first unit
        }
        if (!currentTagFile) {
            neuronIdDisplay.textContent = 'No Tag File Selected';
        }
    }
}

function highlightMatchedText(text, searchText, highlightClass) {
    if (!searchText) return text;
    const searches = searchText.split(/&&|\+\+|\^\^/).map(s => s.trim());
    let highlightedText = text;

    searches.forEach(search => {
        if (search.startsWith('%') && highlightClass === 'highlight-note') {
            // For notes
            const searchString = escapeRegExp(search.slice(1));
            const regex = new RegExp(`(${searchString})`, 'gi');
            highlightedText = highlightedText.replace(regex, `<span class="${highlightClass}">$1</span>`);
        } else if ((search.startsWith('"') && search.endsWith('"')) || (search.startsWith("'") && search.endsWith("'")) && highlightClass === 'highlight-id') {
            // For unit IDs
            const searchString = escapeRegExp(search.slice(1, -1));
            const regex = new RegExp(`(${searchString})`, 'gi');
            highlightedText = highlightedText.replace(regex, `<span class="${highlightClass}">$1</span>`);
        }
    });

    return highlightedText;
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function appendAllFolderNamesToNeuronLabels() {
    if (!currentTagFile) {
        alert('Please select a tag file first.');
        return;
    }

    try {
        // Fetch all folder names from the server
        const response = await fetch('/list-folder-names');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const folderNames = await response.json();

        let updated = false;
        folderNames.forEach(folderName => {
            if (!neuronLabels[folderName]) {
                neuronLabels[folderName] = [];  // Initialize with an empty list if not exist
                updated = true;
            }
        });

        console.log('All Folder Names:', folderNames);

        if (updated) {
            await updateJSON();  // Use existing function to update the server
            alert('All folder names have been added to the current tag file.');
            await fetchUnitLabels();  // Reload the labels to update the UI
        } else {
            alert('No new folder names to add.');
        }
    } catch (error) {
        console.error('Error appending folder names:', error);
        alert(`Error appending folder names: ${error.message}`);
    }
}

function createFile(fileName) {
    const fullFileName = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
    fetch('/create-file', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileName: fullFileName }),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('网络响应失败');
        }
        return response.json();
    })
    .then(async data => {
        if (data.fileName) {
            populateDropdown();  // 创建新文件后刷新下拉菜单
            setCurrentTagFile(data.fileName);  // 设定新文件为当前选择
            await updateLogPath()
        } else {
            throw new Error('服务器未返回文件名');
        }
    })
    .catch(error => {
        console.error('创建文件时出错:', error);
    });
}

function setCurrentTagFile(fileName) {
    currentTagFile = fileName;
    const dropdown = document.getElementById('tagFileDropdown');
    dropdown.value = fileName;
    record.lastUsedTagFile = currentTagFile;
    
    updateLogRecord(); // update the record
    fetchUnitLabels();  // Load the labels for the new file
}

async function selectFolder() {
    try {
        const dirHandle = await window.showDirectoryPicker();
        const folderPath = dirHandle.name;
        
        const response = await fetch('/update-units-figures-path', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ folderName: folderPath }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message);
        }

        const data = await response.json();
        currentUnitsPath = data.absolutePath;
        updateUnitsPathLink();
        console.log('currentUnitsPath:', currentUnitsPath);
        alert(`UnitsPath updated: ${currentUnitsPath}`);

        // Fetch the current log data
        const logResponse = await fetch('/last-used-data');
        const logData = await logResponse.json();

        if (logData.records && logData.records[currentUnitsPath]) {
            // The selected folder is in the log records
            record = logData.records[currentUnitsPath];
            console.log('Found existing record for this path:', record);

            if (record.lastUsedTagFile) {
                currentTagFile = record.lastUsedTagFile;
                console.log('Using tag file from record:', currentTagFile);
            } else {
                await selectFirstJsonFile();
            }
        } else {
            // The selected folder is not in the log records
            console.log('No existing record for this path. Creating a new one.');
            record = {"setups": {}};
            
            await selectFirstJsonFile();
            // update the record with the current tag file
            
        }

        // if currentTagFile is not null, add it as a new setup in setups
        if (currentTagFile) {
            record.setups[currentTagFile] = {};
        }

        record.lastUsedTagFile = currentTagFile;

        // Update the log file with the new or existing record
        await updateLogPath()
        await updateLogRecord()

        await fetchUnitLabels();
        allFolderNames = await fetch('/list-folder-names').then(res => res.json());
        await loadImages();
        populateDropdown();
        displayCurrentUnit();

    } catch (err) {
        console.error('error when selecting folder:', err);
        alert('error when selecting folder: ' + err.message);
    }
}

async function selectFirstJsonFile() {
    const jsonFilesResponse = await fetch('/json-files');
    const jsonFiles = await jsonFilesResponse.json();
    
    if (jsonFiles.length > 0) {
        currentTagFile = jsonFiles[0];
        console.log('Selected first JSON file:', currentTagFile);
    } else {
        console.log('No JSON files found in the selected folder');
        currentTagFile = null;
    }
}

async function updateLogPath() {
    try {
        const response = await fetch('/update-log-path', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ lastUsedUnitsPath: currentUnitsPath}),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Failed to update log file path');
        }

        console.log('Log file path updated');
    } catch (error) {
        console.error('Error updating log file path:', error);
        // alert(`Failed to update log file path: ${error.message}`);
    }
}

async function updateLogRecord() {
    try {
        // Then, send the updated record to the server
        const response = await fetch('/update-log-record', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                unitsPath: currentUnitsPath,
                record: record
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Failed to update log file record');
        }

        console.log('Log file record updated');
    } catch (error) {
        console.error('Error updating log file record:', error);
        // alert(`Failed to update log file record: ${error.message}`);
    }
}

function getCurrentNeuronId() {
    return currentUnitId;
}

function updateCurrentQueryDisplay(query) {
    const currentQueryDisplay = document.getElementById('currentQueryDisplay');
    if (query && query.trim() !== '') {
        currentQueryDisplay.textContent = `QURIED: ${query}`;

        // save the query to the setup in the record
        record.setups[currentTagFile].searchText = query;
        updateLogRecord();

    } else {
        currentQueryDisplay.textContent = 'QURIED: <all>';
        // remove the searchText in the setup in the record
        record.setups[currentTagFile].searchText = " ";
        updateLogRecord();
    }
}