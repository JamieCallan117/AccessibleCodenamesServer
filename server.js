const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
let rooms = {};

io.on("connection", (socket) => {
    console.log("User connected.");

    //Need to add all game attributes to newRoom, such as the word list, starting team, list of what type each word is etc.
    socket.once("createRoom", (user, roomName, password, bombWords, neutralWords, teamASquares, teamBSquares, startingTeam, customWords) => {
        let newRoom = { roomName, password, sockets: [], closed: false, bombWords,
            neutralWords, teamASquares, teamBSquares, startingTeam, customWords};

        if (rooms[roomName] !== undefined) {
            socket.emit("createFail", "The room " + roomName + " already exists.")
        } else {
            rooms[newRoom.roomName] = newRoom;

            console.log(user + " created room: " + roomName + ". Password: " + password);

            socket.join(roomName.roomName);
            newRoom.sockets.push(user);

            socket.once("leaveRoom", () => {
                if (!newRoom.closed) {
                    console.log("Host has left. Closing room " + roomName + ".")
                    socket.emit("hostQuit");

                    rooms[roomName] = undefined;

                    newRoom.closed = true;
                }
            });

            socket.once("disconnect", () => {
                if (!newRoom.closed) {
                    console.log("Host has left. Closing room " + roomName + ".")
                    socket.emit("hostQuit");

                    rooms[roomName] = undefined;

                    newRoom.closed = true;
                }
            });
        }
    });

    socket.once("joinRoom", (user, roomName, password) => {
        let roomToJoin = rooms[roomName];

        if (roomToJoin === undefined) {
            console.log("Room " + roomName + " not found.")
            socket.emit("joinFail", "Room " + roomName + " not found.")
        } else if (roomToJoin.password !== password) {
            console.log("Invalid password for room " + roomName + ".")
            socket.emit("joinFail", "Invalid password for room " + roomName + ".")
            //If an error replace === with ==
        } else if (roomToJoin.sockets.find(userName => user === userName) !== undefined) {
            console.log("Username " + user + " in use.")
            socket.emit("joinFail", "Username " + user + " in use.")
        } else {
            console.log("User " + user + " successfully joined room " + roomName + ".")
            socket.join(roomName);
            roomToJoin.sockets.push(user);

            socket.once("leaveRoom", () => {
                const index = roomToJoin.sockets.indexOf(user);

                if (index > -1) {
                    console.log("User " + user + " has left the room " + roomName + ".");
                    roomToJoin.sockets.splice(index, 1);
                }
            });

            socket.once("disconnect", () => {
                const index = roomToJoin.sockets.indexOf(user);

                if (index > -1) {
                    console.log("User " + user + " has disconnected.");
                    roomToJoin.sockets.splice(index, 1);
                }
            });
        }
    });

    socket.on("getAllRooms", () => {
        socket.emit("allRooms", rooms);
    });

    //Add functionality
    socket.on("getGameDetails", (roomName) => {
        console.log("Retrieving game details for room " + roomName + ".");
    });

    socket.on("requestSpymaster", (user, roomName) => {
        console.log("User " + user + " has request spymaster in room " + roomName + ".");
        io.to(roomName).emit("spymasterRequest", user);
    });

    socket.on("chooseTeam", (user, team, roomName) => {
        console.log("User " + user + " has joined team " + team + ".");
        io.to(roomName).emit("teamChange", user, team);
    });

    socket.on("getUsers", (roomName) => {
        console.log("Returning users for room " + roomName + ".");
        socket.emit("roomUsers", rooms[roomName].sockets)
    });

    socket.on("wordButton", (word, roomName) => {
        io.to(roomName).emit("wordButton", word);
        console.log("Word " + word + " selected in room " + roomName + ".");
    });

    socket.on("hint", (hint, roomName) => {
        console.log("Hint " + hint + " for room " + roomName + ".");
        io.to(roomName).emit("hint", hint);
    });

    socket.on("chat", (user, team, message, roomName) => {
        console.log("Message from user " + user + " on team " + team + ": " + message);

        switch(team) {
            case "a":
                io.to(roomName).emit("teamAChat",user + ": " + message);
                break;
            case "b":
                io.to(roomName).emit("teamBChat",user + ": " + message);
                break;
        }
    });
});


server.listen(3000, () => {
    console.log("listening on 3000");
});