const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
let rooms = {};

io.on("connection", (socket) => {
    console.log("User connected.");

    socket.once("createRoom", (user, roomName, password, allWords, bombWords, neutralWords, teamASquares, teamBSquares, startingTeam) => {
        let newRoom = { roomName, password, users: [], closed: false, started: false, teamAUsers: [], teamBUsers: [],
            teamASpy: undefined, teamBSpy: undefined, allWords, bombWords, neutralWords, teamASquares, teamBSquares, startingTeam };

        if (rooms[roomName] !== undefined) {
            socket.emit("createFail", "The room " + roomName + " already exists.")
        } else {
            rooms[newRoom.roomName] = newRoom;

            console.log(user + " created room: " + roomName + ". Password: " + password);

            socket.join(roomName.roomName);
            newRoom.users.push(user);

            socket.once("startGame", () => {
                if ((newRoom.teamAUsers.length + newRoom.teamBUsers.length) !== newRoom.users.length) {
                    socket.emit("startFail");
                } else {
                    newRoom.started = true;
                    socket.emit("startSuccess")
                }
            });

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
        } else if (roomToJoin.users.find(userName => user === userName) !== undefined) {
            console.log("Username " + user + " in use.")
            socket.emit("joinFail", "Username " + user + " in use.")
        } else if (roomToJoin.started) {
            console.log("Room " + roomName + " has already started.");
            socket.emit("joinFail", "Room " + roomName + " has already started.");
        } else {
            console.log("User " + user + " successfully joined room " + roomName + ".")
            socket.join(roomName);
            roomToJoin.users.push(user);

            socket.once("leaveRoom", () => {
                const index = roomToJoin.users.indexOf(user);

                if (index > -1) {
                    console.log("User " + user + " has left the room " + roomName + ".");
                    roomToJoin.users.splice(index, 1);
                }
            });

            socket.once("disconnect", () => {
                const index = roomToJoin.users.indexOf(user);

                if (index > -1) {
                    console.log("User " + user + " has disconnected.");
                    roomToJoin.users.splice(index, 1);
                }
            });
        }
    });

    socket.on("getAllRooms", () => {
        socket.emit("allRooms", rooms);
    });

    socket.on("getGameDetails", (roomName) => {
        console.log("Retrieving game details for room " + roomName + ".");
        socket.emit("gameDetails", rooms[roomName].allWords, rooms[roomName].teamAUsers, rooms[roomName].teamBUsers,
            rooms[roomName].teamASpy, rooms[roomName].teamBSpy, rooms[roomName].bombWords, rooms[roomName].neutralWords,
            rooms[roomName].teamASquares, rooms[roomName].teamBSquares, rooms[roomName].startingTeam);
    });

    socket.on("requestSpymaster", (user, roomName, teamSpymaster) => {
        console.log("User " + user + " has request spymaster for team " + teamSpymaster + " in room " + roomName + ".");

        if (teamSpymaster === "A") {
            if (rooms[roomName].teamASpy === undefined) {
                rooms[roomName].teamASpy = user;
                io.to(roomName).emit("teamASpymaster", user);
            } else {
                socket.emit("spymasterFail")
            }
        } else {
            if (rooms[roomName].teamBSpy === undefined) {
                rooms[roomName].teamBSpy = user;
                io.to(roomName).emit("teamBSpymaster", user);
            } else {
                socket.emit("spymasterFail")
            }
        }
    });

    socket.on("chooseTeam", (user, team, roomName) => {
        const teamAIndex = rooms[roomName].teamAUsers.indexOf(user);
        const teamBIndex = rooms[roomName].teamBUsers.indexOf(user);

        if (teamAIndex > -1) {
            console.log("User " + user + " has left team A.");
            rooms[roomName].teamAUsers.splice(teamAIndex, 1);
            rooms[roomName].teamBUsers.push(user);
        } else if (teamBIndex > -1) {
            console.log("User " + user + " has left team B.");
            rooms[roomName].teamBUsers.splice(teamBIndex, 1);
            rooms[roomName].teamAUsers.push(user);
        } else {
            if (team === "A") {
                rooms[roomName].teamAUsers.push(user);
            } else {
                rooms[roomName].teamBUsers.push(user);
            }
        }

        console.log("User " + user + " has joined team " + team + ".");

        io.to(roomName).emit("teamChange", user, team);
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