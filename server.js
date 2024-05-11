const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const Docker = require('dockerode');
const pty = require('node-pty');
const app = express();

const server = http.createServer(app);
const io = new Server(server);
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Client connected');

    // Create a new container for each new user
    docker.createContainer({
        Image: 'ubuntu', // Ensure this image has utilities like top, nano, nvim installed
        Tty: true,
        Cmd: ['/bin/bash'],
        OpenStdin: true
    }).then(container => {
        return container.start().then(() => container);
    }).then(container => {
        const exec = pty.spawn('docker', ['exec', '-it', container.id, 'bash'], {
            name: 'xterm-color',
            cols: 80,
            rows: 30,
        });

        exec.onData(data => {
            socket.emit('serverData', data);
        });

        socket.on('clientData', (data) => {
            exec.write(data);
        });

        socket.on('disconnect', () => {
            exec.kill();
            container.stop().then(() => container.remove());
        });
    }).catch(err => {
        console.error('Error with Docker container:', err);
    });
});

const port = 3000; //Change port here
server.listen(port, () => console.log(`Server running on port ${port}`));
