const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();

let basePath = __dirname;  // Default base path that can be updated
let unitsPath = path.join(__dirname, 'units'); // Initialize unitsPath
let tagsPath = unitsPath; // tagsPath is now the same as unitsPath

app.use(cors());
app.use(express.json());
app.use(express.static(basePath));


app.get('/', (req, res) => {
    res.sendFile(path.join(basePath, 'index.html'));
});

// Endpoint to list JSON files in the units_tags directory
app.get('/json-files', (req, res) => {
    fs.readdir(unitsPath, (err, files) => {
        if (err) {
            console.error('Error reading directory:', err);
            return res.status(500).send('Error retrieving files');
        }
        // Filter for JSON files only
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        res.json(jsonFiles);
    });
});

// Endpoint to read the log to get the previously used tag file
app.get('/last-used-tag-file', (req, res) => {
    const logPath = path.join(basePath, 'log.json');
    fs.readFile(logPath, 'utf8', (err, data) => {
        if (err) {
            console.log(err);
            return res.status(500).send('Error retrieving log.json');
        }
        const log = JSON.parse(data);
        res.json(log.lastUsedTagFile);
    });
});

// Replace the existing update-last-used-tag-file route
app.post('/update-last-used-tag-file', (req, res) => {
    const logPath = path.join(basePath, 'log.json');
    const newTagFile = req.body.lastUsedTagFile;
    const logData = { lastUsedTagFile: newTagFile };

    fs.writeFile(logPath, JSON.stringify(logData, null, 2), 'utf8', (err) => {
        if (err) {
            console.error('Error writing log.json:', err);
            return res.status(500).send('Failed to update log.json');
        }
        res.send('log.json updated successfully');
    });
});

app.get('/units/:neuronId', (req, res) => {
    const itemPath = path.join(unitsPath, req.params.neuronId);
    console.log('Accessing path:', itemPath);

    fs.stat(itemPath, (err, stats) => {
        if (err) {
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
                const imageFiles = files.filter(file => /\.(png|jpg|jpeg|gif)$/i.test(file));
                imageFiles.sort();
                console.log('Image files:', imageFiles);
                res.json(imageFiles);
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
    fs.readdir(unitsPath, { withFileTypes: true }, (err, dirents) => {
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
    const filePath = path.join(tagsPath, fileName);
    fs.writeFile(filePath, '{}', (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Failed to create file.');
        }
        res.send({ message: 'File created successfully.', fileName: fileName });
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

    unitsPath = newPath;
    tagsPath = newPath;

    console.log('Updated units and tags path:', unitsPath);

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
        newPath: unitsPath,
        displayPath: displayPath,
        absolutePath: path.resolve(unitsPath)  // Add this line to send the absolute path
    });
});

app.listen(2024, () => {
    console.log('Server is running on http://localhost:2024');
    console.log('Current basePath:', basePath);
    console.log('Current unitsPath:', unitsPath);
    console.log('Current tagsPath:', tagsPath);
});

function listFolderNames() {
    return new Promise((resolve, reject) => {
        fs.readdir(unitsPath, { withFileTypes: true }, (err, files) => {
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
    const imagePath = path.join(unitsPath, req.params.neuronId, req.params.imageName);
    res.sendFile(imagePath, (err) => {
        if (err) {
            console.error('Error sending image:', err);
            res.status(404).send('Image not found');
        }
    });
});

// Replace the existing get-last-used-tag-file route
app.get('/get-last-used-tag-file', (req, res) => {
    const logPath = path.join(basePath, 'log.json');
    fs.readFile(logPath, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                return res.json({ lastUsedTagFile: null });
            }
            console.error('Error reading log.json:', err);
            return res.status(500).json({ error: 'Failed to read log.json' });
        }
        try {
            const logData = JSON.parse(data);
            res.json({ lastUsedTagFile: logData.lastUsedTagFile });
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
    const parentPath = path.dirname(unitsPath);
    const parentFolderName = path.basename(parentPath);
    const displayPath = `../${parentFolderName}/${path.basename(unitsPath)}`;
    res.json({ displayPath: displayPath });
});
