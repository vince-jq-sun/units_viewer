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
    const neuronDir = path.join(unitsPath, req.params.neuronId);
    console.log('Accessing neuron directory:', neuronDir);
    fs.readdir(neuronDir, (err, files) => {
        if (err) {
            console.error('Error reading neuron directory:', err);
            return res.status(500).json({ error: 'Unable to scan directory' });
        }
        console.log('Files in neuron directory:', files);
        const imageFiles = files.filter(file => /\.(png|jpg|jpeg|gif)$/i.test(file));
        imageFiles.sort();
        console.log('Image files:', imageFiles);
        res.json(imageFiles);
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
    listFolderNames()
        .then(folderNames => {
            res.json(folderNames);
        })
        .catch(error => {
            console.error('Failed to list folders:', error);
            res.status(500).send('Failed to retrieve folder names');
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
    
    const newPath = path.join(__dirname, '..', folderName);
    const parentPath = path.dirname(newPath);
    const parentFolderName = path.basename(parentPath);

    console.log('New path:', newPath);

    if (!fs.existsSync(newPath)) {
        return res.status(400).json({ success: false, message: 'Selected folder does not exist' });
    }

    unitsPath = newPath;
    tagsPath = newPath;

    console.log('Updated units and tags path:', unitsPath);

    // Check if any JSON files exist in the new folder
    const jsonFiles = fs.readdirSync(newPath).filter(file => file.endsWith('.json'));
    
    res.json({ 
        success: true, 
        message: 'Path updated successfully',
        hasJsonFiles: jsonFiles.length > 0,
        newPath: unitsPath,
        displayPath: `../${parentFolderName}/${path.basename(newPath)}`
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
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return res.status(404).send('File not found');
        }
        res.json(JSON.parse(data));
    });
});

app.get('/get-current-units-path', (req, res) => {
    const parentPath = path.dirname(unitsPath);
    const parentFolderName = path.basename(parentPath);
    const displayPath = `../${parentFolderName}/${path.basename(unitsPath)}`;
    res.json({ displayPath: displayPath });
});
