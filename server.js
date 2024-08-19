const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();

let basePath = __dirname;  // Default base path that can be updated
let tagsPath = path.join(basePath, 'units_tags');

app.use(cors());
app.use(express.json());
app.use(express.static(basePath));

app.get('/', (req, res) => {
    res.sendFile(path.join(basePath, 'index.html'));
});

// Endpoint to list JSON files in the units_tags directory
app.get('/json-files', (req, res) => {
    fs.readdir(tagsPath, (err, files) => {
        if (err) {
            console.log(err);
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

// Endpoint to Update lastUsedTagFile
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

app.get('/units_figures/:neuronId', (req, res) => {
    const neuronDir = path.join(basePath, 'units_figures', req.params.neuronId);
    fs.readdir(neuronDir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Unable to scan directory' });
        }
        const imageFiles = files.filter(file => /\.(png|jpg|jpeg|gif)$/i.test(file));
        imageFiles.sort();
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

app.listen(2024, () => {
    console.log('Server is running on http://localhost:2024');
    import('open').then(open => {
        open.default('http://localhost:2024').catch(error => {
            console.error('Failed to open browser:', error);
        });
    });
});

function listFolderNames() {
    return new Promise((resolve, reject) => {
        const fs = require('fs');
        const figuresPath = path.join(__dirname, 'units_figures');

        fs.readdir(figuresPath, { withFileTypes: true }, (err, files) => {
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
