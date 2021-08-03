const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
let rooms = {};

io.on("connection", (socket) => {
    console.log("User connected.");

    socket.on("createRoom", (user, roomName, password) => {
        let newRoom = { roomName, password, sockets: [] };

        if (rooms[roomName] !== undefined) {
            socket.emit("createFail", "The room " + roomName + " already exists.")
        } else {
            rooms[newRoom.roomName] = newRoom;

            console.log(user + " created room: " + roomName + ". Password: " + password);

            socket.join(roomName);
            newRoom.sockets.push(user);
        }

        socket.on("leaveRoom", () => {
            const index = newRoom.sockets.indexOf(user);

            if (index > -1) {
                console.log("User " + user + " has left the room " + roomName + ".");
                newRoom.sockets.splice(index, 1);
            }
        });

        socket.on("disconnect", () => {
            const index = newRoom.sockets.indexOf(user);

            if (index > -1) {
                console.log("User " + user + " has disconnected.");
                newRoom.sockets.splice(index, 1);
            }
        });
    });

    socket.on("joinRoom", (user, roomName, password) => {
        let roomToJoin = rooms[roomName];

        if (roomToJoin === undefined) {
            console.log("Room " + roomName + " not found.")
            socket.emit("joinFail", "Room " + roomName + " not found.")
        } else if (roomToJoin.password !== password) {
            console.log("Invalid password for room " + roomName + ".")
            socket.emit("joinFail", "Invalid password for room " + roomName + ".")
        } else if (roomToJoin.sockets.find(userName => user == userName) !== undefined) {
            console.log("Username " + user + " in use.")
            socket.emit("joinFail", "Username " + user + " in use.")
        } else {
            console.log("User " + user + " successfully joined room " + roomName + ".")
            socket.join(roomName);
            roomToJoin.sockets.push(user);
        }

        socket.on("leaveRoom", () => {
            const index = roomToJoin.sockets.indexOf(user);

            if (index > -1) {
                console.log("User " + user + " has left the room " + roomName + ".");
                roomToJoin.sockets.splice(index, 1);
            }
        });

        socket.on("disconnect", () => {
            const index = roomToJoin.sockets.indexOf(user);

            if (index > -1) {
                console.log("User " + user + " has disconnected.");
                roomToJoin.sockets.splice(index, 1);
            }
        });
    });

    socket.on("getUsers", (roomName) => {
        console.log("Returning users for room " + roomName + ".");
        socket.emit("roomUsers", rooms[roomName].sockets)
    });

    //
    //     socket.on("wordButton", (word) => {
    //         console.log("WordButton: " + word);
    //         io.to(user.room).emit("wordButton", word);
    //     })
    //
    //     socket.on("neutral", (word) => {
    //         console.log("Neutral: " + word);
    //         io.to(user.room).emit("neutral",word);
    //     })
    //
    //     socket.on("bomb", (word) => {
    //         console.log("Bomb: " + word);
    //         io.to(user.room).emit("bomb", word);
    //     })
    //
    //     socket.on("hint", (word) => {
    //         console.log("Hint: " + word);
    //         io.to(user.room).emit("hint", word);
    //     })
    //
    //     socket.on("chat", (word) => {
    //         console.log("Chat: " + word);
    //         io.to(user.room).emit("chat", word);
    //     })
    // })
});


server.listen(3000, () => {
    console.log("listening on 3000");
});