const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();

let basePath = __dirname;  // Default base path that can be updated
let currentUnitsPath = null;
let tagsPath = null;

function initializePathsFromLog() {
    const logPath = path.join(__dirname, 'log.json');
    try {
        const logData = JSON.parse(fs.readFileSync(logPath, 'utf8'));
        
        // Check if lastUsedUnitsPath exists and is a non-empty string
        if (logData.lastUsedUnitsPath && typeof logData.lastUsedUnitsPath === 'string' && logData.lastUsedUnitsPath.trim() !== '') {
            currentUnitsPath = logData.lastUsedUnitsPath;
            tagsPath = currentUnitsPath; // Set tagsPath equal to currentUnitsPath
        } else {
            throw new Error('Invalid or missing lastUsedUnitsPath in log file');
        }
        
        console.log('Paths initialized from log:', { currentUnitsPath, tagsPath });
    } catch (error) {
        console.error('Error reading or parsing log file:', error);
        currentUnitsPath = null;
        tagsPath = null;
    }
}

// Initialize the paths when the server starts
initializePathsFromLog();

// Add a function to check if paths are initialized
function arePathsInitialized() {
    return currentUnitsPath !== null && tagsPath !== null;
}

// Update both paths when changing the units path
app.post('/update-units-path', (req, res) => {
    const { newPath } = req.body;
    if (fs.existsSync(newPath)) {
        currentUnitsPath = newPath;
        tagsPath = newPath; // Update tagsPath as well
        // Update log file
        fs.writeFileSync('log.json', JSON.stringify({ lastUsedUnitsPath: currentUnitsPath }));
        res.json({ success: true, path: currentUnitsPath });
    } else {
        res.status(400).json({ success: false, message: 'Invalid path' });
    }
});

// Update the endpoint to get current paths
app.get('/current-paths', (req, res) => {
    if (arePathsInitialized()) {
        res.json({ unitsPath: currentUnitsPath, tagsPath: tagsPath });
    } else {
        res.status(500).json({ error: 'Paths not initialized', unitsPath: null, tagsPath: null });
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static(basePath));


app.get('/', (req, res) => {
    res.sendFile(path.join(basePath, 'index.html'));
});

// Endpoint to list JSON files in the units_tags directory
app.get('/json-files', (req, res) => {
    fs.readdir(currentUnitsPath, (err, files) => {
        if (err) {
            console.error('Error reading directory:', err);
            return res.status(500).send('Error retrieving files');
        }
        // Filter for JSON files only
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        res.json(jsonFiles);
    });
});


app.post('/update-log-file', (req, res) => {
    const { lastUsedTagFile, lastUsedUnitsPath } = req.body;

    if (!lastUsedTagFile || !lastUsedUnitsPath) {
        return res.status(400).send('Missing required fields');
    }

    const logData = {
        lastUsedTagFile,
        lastUsedUnitsPath
    };

    fs.writeFile('log.json', JSON.stringify(logData, null, 2), (err) => {
        if (err) {
            console.error('Error writing to log.json:', err);
            return res.status(500).send('Failed to update log.json');
        }
        res.send('log.json updated successfully');
    });
});

app.listen(3000, () => {
    console.log('Server is running on port 2024');
});

app.get('/units/:neuronId', (req, res) => {
    if (!arePathsInitialized()) {
        return res.status(500).json({ error: 'Paths not initialized' });
    }
    const itemPath = path.join(currentUnitsPath, req.params.neuronId);
    console.log('Accessing path:', itemPath);

    fs.stat(itemPath, (err, stats) => {
        if (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).json({ error: 'Folder not found' });
            }
            console.error('Error accessing path:', err);
            return res.status(500).json({ error: 'Unable to access path' });
        }

        if (stats.isDirectory()) {
            // Handle directory (neuron) case
            fs.readdir(itemPath, (err, files) => {
                if (err) {
                    console.error('Error reading directory:', err);
                    return res.status(500).json({ error: 'Unable to scan directory' });
                }
                console.log('Files in directory:', files);
                const imageFiles = files.filter(file => /\.(png|jpg|jpeg|gif|bmp|webp|tiff|svg|pdf|eps)$/i.test(file));
                imageFiles.sort();
                console.log('Image files:', imageFiles);
                res.json({ exists: true, images: imageFiles });
            });
        } else if (stats.isFile() && path.extname(itemPath) === '.json') {
            // Handle JSON file case
            fs.readFile(itemPath, 'utf8', (err, data) => {
                if (err) {
                    console.error('Error reading JSON file:', err);
                    return res.status(500).json({ error: 'Unable to read JSON file' });
                }
                try {
                    const jsonData = JSON.parse(data);
                    res.json(jsonData);
                } catch (parseError) {
                    console.error('Error parsing JSON:', parseError);
                    res.status(500).json({ error: 'Error parsing JSON file' });
                }
            });
        } else {
            res.status(400).json({ error: 'Invalid path' });
        }
    });
});

app.post('/update_units_tags', (req, res) => {
    const { fileName, data } = req.body;
    if (!fileName || !data) {
        return res.status(400).json({ message: 'File name or data is missing.' });
    }

    fs.writeFile(path.join(tagsPath, fileName), JSON.stringify(data, null, 2), (err) => {
        if (err) {
            console.error('Error writing JSON file:', err);
            return res.status(500).json({ message: 'Failed to update JSON file.' });
        }
        res.json({ message: 'JSON file updated successfully.' });
    });
});

app.get('/list-folder-names', (req, res) => {
    fs.readdir(currentUnitsPath, { withFileTypes: true }, (err, dirents) => {
        if (err) {
            console.error('Failed to list folders:', err);
            return res.status(500).json({ error: 'Failed to retrieve folder names' });
        }
        const folderNames = dirents
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        res.json(folderNames);
    });
});

app.post('/create-file', (req, res) => {
    const { fileName } = req.body;
    const filePath = path.join(currentUnitsPath, fileName);

    fs.writeFile(filePath, '{}', (err) => {
        if (err) {
            console.error('Error creating file:', err);
            res.status(500).json({ error: 'Failed to create file' });
        } else {
            // Update the log file with the new tag file
            const logPath = path.join(__dirname, 'log.json');
            const logData = JSON.parse(fs.readFileSync(logPath, 'utf8'));
            logData.lastUsedTagFile = fileName;
            fs.writeFileSync(logPath, JSON.stringify(logData, null, 2));

            console.log('New file created:', fileName);
            res.json({ fileName: fileName });
        }
    });
});

app.post('/update-units-figures-path', (req, res) => {
    const { folderName } = req.body;
    
    // Try different base paths
    const possiblePaths = [
        path.join(__dirname, '..', folderName),  // Original relative path
        path.join(__dirname, folderName),        // Direct child of server directory
        path.resolve(folderName)                 // Absolute path or relative to current working directory
    ];

    let newPath = null;
    for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
            newPath = testPath;
            break;
        }
    }

    if (!newPath) {
        return res.status(400).json({ success: false, message: 'Selected folder does not exist' });
    }

    currentUnitsPath = newPath;
    tagsPath = newPath;

    console.log('Updated units and tags path:', currentUnitsPath);

    // Check if any JSON files exist in the new folder
    const jsonFiles = fs.readdirSync(newPath).filter(file => file.endsWith('.json'));
    
    // Prepare the display path
    const parentPath = path.dirname(newPath);
    const parentFolderName = path.basename(parentPath);
    const displayPath = `../${parentFolderName}/${path.basename(newPath)}`;

    res.json({ 
        success: true, 
        message: 'Path updated successfully',
        hasJsonFiles: jsonFiles.length > 0,
        newPath: currentUnitsPath,
        displayPath: displayPath,
        absolutePath: path.resolve(currentUnitsPath)  // Add this line to send the absolute path
    });
});

app.listen(2024, async () => {
    console.log('Server is running on http://localhost:2024');
    console.log('Current basePath:', basePath);
    console.log('Current currentUnitsPath:', currentUnitsPath);
    console.log('Current tagsPath:', tagsPath);
    
    try {
        // Dynamically import the 'open' package
        const open = await import('open');
        // Auto-launch the browser
        await open.default('http://localhost:2024');
    } catch (error) {
        console.error('Failed to open browser:', error);
    }
});

function listFolderNames() {
    return new Promise((resolve, reject) => {
        fs.readdir(currentUnitsPath, { withFileTypes: true }, (err, files) => {
            if (err) {
                console.error('Failed to list folders:', err);
                reject(err);
                return;
            }
            const folderNames = files
                .filter(item => item.isDirectory())
                .map(folder => folder.name);
            resolve(folderNames);
        });
    });
}

function getCurrentNeuronId() {
    return currentUnitId;
}


// Add this new route after your existing routes
app.get('/units/:neuronId/:imageName', (req, res) => {
    const imagePath = path.join(currentUnitsPath, req.params.neuronId, req.params.imageName);
    res.sendFile(imagePath, (err) => {
        if (err) {
            console.error('Error sending image:', err);
            res.status(404).send('Image not found');
        }
    });
});

app.get('/last-used-data', (req, res) => {
    const logPath = path.join(basePath, 'log.json');
    fs.readFile(logPath, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                return res.json({ lastUsedTagFile: null, lastUsedUnitsPath: null });
            }
            console.error('Error reading log.json:', err);
            return res.status(500).json({ error: 'Failed to read log.json' });
        }
        try {
            const log = JSON.parse(data);
            res.json({
                lastUsedTagFile: log.lastUsedTagFile,
                lastUsedUnitsPath: log.lastUsedUnitsPath
            });
        } catch (parseError) {
            console.error('Error parsing log.json:', parseError);
            res.status(500).json({ error: 'Failed to parse log.json' });
        }
    });
});

app.get('/units/:fileName', (req, res) => {
    const filePath = path.join(tagsPath, req.params.fileName);
    if (!filePath.endsWith('.json')) {
        return res.status(400).json({ error: 'Invalid file type' });
    }
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            if (err.code === 'ENOENT') {
                return res.status(404).json({ error: 'File not found' });
            }
            return res.status(500).json({ error: 'Error reading file' });
        }
        try {
            const jsonData = JSON.parse(data);
            res.json(jsonData);
        } catch (parseError) {
            console.error('Error parsing JSON:', parseError);
            res.status(500).json({ error: 'Error parsing JSON file' });
        }
    });
});

app.get('/get-current-units-path', (req, res) => {
    res.json({ displayPath: currentUnitsPath });
});
