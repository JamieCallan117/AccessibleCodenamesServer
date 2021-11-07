const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
let rooms = {};

//Initial client connection.
io.on("connection", (socket) => {
    console.log("User connected.");

    //Creates a game room
    socket.once("createRoom", (user, roomName, password, allWords, bombWords, neutralWords, teamASquares,
                               teamBSquares, startingTeam) => {
        let newRoom = { roomName, password, users: [], closed: false, started: false, teamAUsers: [], teamBUsers: [],
            teamASpy: undefined, teamBSpy: undefined, allWords, bombWords, neutralWords, teamASquares, teamBSquares,
            startingTeam };

        if (rooms[roomName] !== undefined) {
            socket.emit("createFail", "The room " + roomName + " already exists.")
        } else {
            rooms[newRoom.roomName] = newRoom;

            console.log(user + " created room: " + roomName + ". Password: " + password);

            socket.join(roomName);
            newRoom.users.push(user);

            socket.on("startGame", () => {
                if ((newRoom.teamAUsers.length + newRoom.teamBUsers.length) !== newRoom.users.length) {
                    console.log("Cannot start game. Not all users have selected a team.");
                    socket.emit("startFail", "Not all users have selected a team.");
                } else if (newRoom.teamASpy === undefined) {
                    console.log("Cannot start game. Team A does not have a Spymaster.");
                    socket.emit("startFail", "Team A does not have a Spymaster.");
                } else if (newRoom.teamBSpy === undefined) {
                    console.log("Cannot start game. Team B does not have a Spymaster.");
                    socket.emit("startFail", "Team B does not have a Spymaster.");
                } else if (newRoom.teamAUsers.length < 2) {
                    console.log("Cannot start game. Team A does not have enough members.");
                    socket.emit("startFail", "Team A does not have enough members.");
                } else if (newRoom.teamBUsers.length < 2) {
                    console.log("Cannot start game. Team B does not have enough members.");
                    socket.emit("startFail", "Team B does not have enough members.");
                } else {
                    newRoom.started = true;
                    console.log("Successfully started game in room " + roomName);
                    io.to(roomName).emit("startSuccess")
                }
            });

            socket.once("leaveRoom", () => {
                if (!newRoom.closed) {
                    console.log("Host has left. Closing room " + roomName + ".")
                    io.to(roomName).emit("hostQuit");

                    rooms[roomName] = undefined;

                    newRoom.closed = true;
                }
            });

            socket.once("disconnect", () => {
                if (!newRoom.closed) {
                    console.log("Host has left. Closing room " + roomName + ".")
                    io.to(roomName).emit("hostQuit");

                    rooms[roomName] = undefined;

                    newRoom.closed = true;
                }
            });
        }
    });

    //Joins the user to a room
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
            socket.emit("joinFailNick", "Username " + user + " in use.")
        } else if (roomToJoin.started) {
            console.log("Room " + roomName + " has already started.");
            socket.emit("joinFail", "Room " + roomName + " has already started.");
        } else {
            console.log("User " + user + " successfully joined room " + roomName + ".")
            socket.join(roomName);
            roomToJoin.users.push(user);

            socket.once("leaveRoom", () => {
                const index = roomToJoin.users.indexOf(user);
                const teamAIndex = rooms[roomName].teamAUsers.indexOf(user);
                const teamBIndex = rooms[roomName].teamBUsers.indexOf(user);

                if (teamAIndex > -1) {
                    console.log("User " + user + " has left team A.");
                    rooms[roomName].teamAUsers.splice(teamAIndex, 1);
                } else if (teamBIndex > -1) {
                    console.log("User " + user + " has left team B.");
                    rooms[roomName].teamBUsers.splice(teamBIndex, 1);
                }

                if (index > -1) {
                    console.log("User " + user + " has left the room " + roomName + ".");
                    roomToJoin.users.splice(index, 1);
                }

                io.to(roomName).emit("playerQuit", user);

                if (user === roomToJoin.teamASpy) {
                    roomToJoin.teamASpy = undefined;
                    console.log("Team A Spymaster has left the room.");
                    io.to(roomName).emit("spymasterQuitA", user);
                } else if (user === roomToJoin.teamBSpy) {
                    roomToJoin.teamBSpy = undefined;
                    console.log("Team B Spymaster has left the room.");
                    io.to(roomName).emit("spymasterQuitB", user);
                }
            });

            socket.once("disconnect", () => {
                const index = roomToJoin.users.indexOf(user);
                const teamAIndex = rooms[roomName].teamAUsers.indexOf(user);
                const teamBIndex = rooms[roomName].teamBUsers.indexOf(user);

                if (teamAIndex > -1) {
                    console.log("User " + user + " has left team A.");
                    rooms[roomName].teamAUsers.splice(teamAIndex, 1);
                } else if (teamBIndex > -1) {
                    console.log("User " + user + " has left team B.");
                    rooms[roomName].teamBUsers.splice(teamBIndex, 1);
                }

                if (index > -1) {
                    console.log("User " + user + " has disconnected.");
                    roomToJoin.users.splice(index, 1);
                }

                io.to(roomName).emit("playerQuit", user);

                if (user === roomToJoin.teamASpy) {
                    roomToJoin.teamASpy = undefined;
                    console.log("Team A Spymaster has left the room.");
                    io.to(roomName).emit("spymasterQuitA", user);
                } else if (user === roomToJoin.teamBSpy) {
                    roomToJoin.teamBSpy = undefined;
                    console.log("Team B Spymaster has left the room.");
                    io.to(roomName).emit("spymasterQuitB", user);
                }
            });
        }
    });

    //Returns a list of all rooms.
    socket.on("getAllRooms", () => {
        socket.emit("allRooms", rooms);
    });

    //Returns all the values associated with a specific room.
    socket.on("getGameDetails", (roomName) => {
        console.log("Retrieving game details for room " + roomName + ".");
        socket.emit("gameDetails", rooms[roomName].allWords, rooms[roomName].teamAUsers, rooms[roomName].teamBUsers,
            rooms[roomName].teamASpy, rooms[roomName].teamBSpy, rooms[roomName].bombWords, rooms[roomName].neutralWords,
            rooms[roomName].teamASquares, rooms[roomName].teamBSquares, rooms[roomName].startingTeam);
    });

    //Allows a member of a room to request the spymaster role for their team.
    socket.on("requestSpymaster", (user, roomName, teamSpymaster) => {
        console.log("User " + user + " has request spymaster for team " + teamSpymaster + " in room " + roomName + ".");

        //Team A Spymaster.
        if (teamSpymaster === "A") {
            //Successful request.
            if (rooms[roomName].teamASpy === undefined) {
                //Sets the user as the Team A spymaster and emits to all users to update their game details.
                rooms[roomName].teamASpy = user;
                console.log("User " + user + " is now the spymaster for team" + teamSpymaster + " in room " + roomName + ".");
                io.to(roomName).emit("teamASpymaster", user);
            //Failed request.
            } else {
                console.log("User " + user + " was denied spymaster for team" + teamSpymaster + " in room " + roomName + ".");
                socket.emit("spymasterFail")
            }
        //Team B Spymaster.
        } else {
            //Successful request.
            if (rooms[roomName].teamBSpy === undefined) {
                //Sets the user as the Team B spymaster and emits to all users to update their game details.
                rooms[roomName].teamBSpy = user;
                console.log("User " + user + " is now the spymaster for team" + teamSpymaster + " in room " + roomName + ".");
                io.to(roomName).emit("teamBSpymaster", user);
            //Failed request.
            } else {
                console.log("User " + user + " was denied spymaster for team" + teamSpymaster + " in room " + roomName + ".");
                socket.emit("spymasterFail")
            }
        }
    });

    //Lets the user choose their original team or swap team.
    socket.on("chooseTeam", (user, team, roomName) => {
        const teamAIndex = rooms[roomName].teamAUsers.indexOf(user);
        const teamBIndex = rooms[roomName].teamBUsers.indexOf(user);

        //Removes the user from Team A if they wish to swap to Team B
        if (teamAIndex > -1) {
            console.log("User " + user + " has left team A.");
            rooms[roomName].teamAUsers.splice(teamAIndex, 1);
            rooms[roomName].teamBUsers.push(user);
        //Removes the user from Team B if they wish to swap to Team A
        } else if (teamBIndex > -1) {
            console.log("User " + user + " has left team B.");
            rooms[roomName].teamBUsers.splice(teamBIndex, 1);
            rooms[roomName].teamAUsers.push(user);
        //Adds the user to Team A/B depending on which they wish to join.
        } else {
            if (team === "A") {
                rooms[roomName].teamAUsers.push(user);
            } else {
                rooms[roomName].teamBUsers.push(user);
            }
        }

        console.log("User " + user + " has joined team " + team + ".");

        //Emits to let other room members know of the team change.
        io.to(roomName).emit("teamChange", user, team);
    });

    //Used for when a WordButton has been pressed so that all users can update their game status.
    socket.on("wordButton", (word, username, roomName) => {
        io.to(roomName).emit("wordButton", word, username);
        console.log("Word " + word + " selected in room " + roomName + " by " + username + ".");
    });

    //Used for when a user chooses to end their teams turn.
    socket.on("endTurn", (roomName) => {
        io.to(roomName).emit("endTurn");
        console.log("Turn ending in room " + roomName + ".");
    });

    //Used for when a spymaster gives a hint to their team.
    socket.on("hint", (hint, roomName) => {
        console.log("Hint " + hint + " for room " + roomName + ".");
        io.to(roomName).emit("hint", hint);
    });

    //Used for sending chat messages to the room.
    socket.on("chat", (user, team, message, roomName) => {
        console.log("Message from user " + user + " on team " + team + ": " + message);

        switch(team) {
            case "A":
                //Emits to the room that a message from Team A has been sent.
                io.to(roomName).emit("teamAChat", user, message);
                break;
            case "B":
                //Emits to the room that a message from Team B has been sent.
                io.to(roomName).emit("teamBChat", user, message);
                break;
        }
    });
});

//Hosts the server.
server.listen( () => {
    console.log("Server is listening");
});