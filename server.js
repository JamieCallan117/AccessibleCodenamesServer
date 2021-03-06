const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
let rooms = {};

//Initial client connection.
io.on("connection", (socket) => {
    console.log("CS: User connected.");

    //Creates a game room.
    socket.once("createRoom", (user, roomName, password, allWords, bombWords, neutralWords, teamASquares,
                               teamBSquares, startingTeam) => {
        //Sets up the room with all details
        let newRoom = { roomName, password, users: [], closed: false, started: false, teamAUsers: [], teamBUsers: [],
            teamASpy: undefined, teamBSpy: undefined, allWords, bombWords, neutralWords, teamASquares, teamBSquares,
            startingTeam };

        //Checks that a room with this name doesn't already exist.
        if (rooms[roomName] !== undefined) {
            socket.emit("createFail", "The room " + roomName + " already exists.")
        } else {
            //Creates room.
            rooms[newRoom.roomName] = newRoom;

            console.log("CS: " + user + " created room: " + roomName + ". Password: " + password);

            //Adds host to list of users.
            socket.join(roomName);
            newRoom.users.push(user);

            //Start the game.
            socket.on("startGame", () => {
                //If their are users who haven't selected a team, don't start.
                if ((newRoom.teamAUsers.length + newRoom.teamBUsers.length) !== newRoom.users.length) {
                    console.log("CS: Cannot start game. Not all users have selected a team.");
                    socket.emit("startFail", "Not all users have selected a team.");
                //If team A does not have a spymaster, don't start.
                } else if (newRoom.teamASpy === undefined) {
                    console.log("CS: Cannot start game. Team A does not have a Spymaster.");
                    socket.emit("startFail", "Team A does not have a Spymaster.");
                //If team B does not have a spymaster, don't start.
                } else if (newRoom.teamBSpy === undefined) {
                    console.log("CS: Cannot start game. Team B does not have a Spymaster.");
                    socket.emit("startFail", "Team B does not have a Spymaster.");
                //If team A does not have enough members, don't start.
                } else if (newRoom.teamAUsers.length < 2) {
                    console.log("CS: Cannot start game. Team A does not have enough members.");
                    socket.emit("startFail", "Team A does not have enough members.");
                //If team B does not have enough members, don't start.
                } else if (newRoom.teamBUsers.length < 2) {
                    console.log("CS: Cannot start game. Team B does not have enough members.");
                    socket.emit("startFail", "Team B does not have enough members.");
                //Valid game, start.
                } else {
                    newRoom.started = true;
                    console.log("CS: Successfully started game in room " + roomName);
                    io.to(roomName).emit("startSuccess")
                }
            });

            //If host leaves the game, close the room.
            socket.once("leaveRoom", () => {
                if (!newRoom.closed) {
                    console.log("CS: Host has left. Closing room " + roomName + ".")
                    io.to(roomName).emit("hostQuit");

                    rooms[roomName] = undefined;

                    newRoom.closed = true;
                }
            });

            //If hosts disconnects, close the room.
            socket.once("disconnect", () => {
                if (!newRoom.closed) {
                    console.log("CS: Host has left. Closing room " + roomName + ".")
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

        //Check that room exists.
        if (roomToJoin === undefined) {
            console.log("CS: Room " + roomName + " not found.")
            socket.emit("joinFail", "Room " + roomName + " not found.")
        //Check that password is correct.
        } else if (roomToJoin.password !== password) {
            console.log("CS: Invalid password for room " + roomName + ".")
            socket.emit("joinFail", "Invalid password for room " + roomName + ".")
        //Check that username isn't in use.
        } else if (roomToJoin.users.find(userName => user === userName) !== undefined) {
            console.log("CS: Username " + user + " in use.")
            socket.emit("joinFailNick", "Username " + user + " in use.")
        ///Check that game hasn't already started.
        } else if (roomToJoin.started) {
            console.log("CS: Room " + roomName + " has already started.");
            socket.emit("joinFail", "Room " + roomName + " has already started.");
        //Valid join.
        } else {
            console.log("CS: User " + user + " successfully joined room " + roomName + ".")
            socket.join(roomName);
            roomToJoin.users.push(user);

            //If user leaves room.
            socket.once("leaveRoom", () => {
                if (!roomToJoin.closed) {
                    const index = roomToJoin.users.indexOf(user);
                    const teamAIndex = rooms[roomName].teamAUsers.indexOf(user);
                    const teamBIndex = rooms[roomName].teamBUsers.indexOf(user);

                    //Remove the user from their team.
                    if (teamAIndex > -1) {
                        console.log("CS: User " + user + " has left team A.");
                        rooms[roomName].teamAUsers.splice(teamAIndex, 1);
                    } else if (teamBIndex > -1) {
                        console.log("CS: User " + user + " has left team B.");
                        rooms[roomName].teamBUsers.splice(teamBIndex, 1);
                    }

                    if (index > -1) {
                        console.log("CS: User " + user + " has left the room " + roomName + ".");
                        roomToJoin.users.splice(index, 1);
                    }

                    io.to(roomName).emit("playerQuit", user);

                    //If user was a spymaster, reallow spymaster request.
                    if (user === roomToJoin.teamASpy) {
                        roomToJoin.teamASpy = undefined;
                        console.log("CS: Team A Spymaster has left the room.");
                        io.to(roomName).emit("spymasterQuitA");
                    } else if (user === roomToJoin.teamBSpy) {
                        roomToJoin.teamBSpy = undefined;
                        console.log("CS: Team B Spymaster has left the room.");
                        io.to(roomName).emit("spymasterQuitB");
                    }
                }
            });

            //If user disconnects.
            socket.once("disconnect", () => {
                if (!roomToJoin.closed) {
                    const index = roomToJoin.users.indexOf(user);
                    const teamAIndex = rooms[roomName].teamAUsers.indexOf(user);
                    const teamBIndex = rooms[roomName].teamBUsers.indexOf(user);

                    //Remove the user from their team.
                    if (teamAIndex > -1) {
                        console.log("CS: User " + user + " has left team A.");
                        rooms[roomName].teamAUsers.splice(teamAIndex, 1);
                    } else if (teamBIndex > -1) {
                        console.log("CS: User " + user + " has left team B.");
                        rooms[roomName].teamBUsers.splice(teamBIndex, 1);
                    }

                    if (index > -1) {
                        console.log("CS: User " + user + " has disconnected.");
                        roomToJoin.users.splice(index, 1);
                    }

                    io.to(roomName).emit("playerQuit", user);

                    //If user was a spymaster, reallow spymaster request.
                    if (user === roomToJoin.teamASpy) {
                        roomToJoin.teamASpy = undefined;
                        console.log("CS: Team A Spymaster has left the room.");
                        io.to(roomName).emit("spymasterQuitA", user);
                    } else if (user === roomToJoin.teamBSpy) {
                        roomToJoin.teamBSpy = undefined;
                        console.log("CS: Team B Spymaster has left the room.");
                        io.to(roomName).emit("spymasterQuitB", user);
                    }
                }
            });
        }
    });

    //Returns a list of all rooms.
    socket.on("getAllRooms", () => {
        console.log("CS: Retrieving all rooms");
        socket.emit("allRooms", rooms);
    });

    //Returns all the values associated with a specific room.
    socket.on("getGameDetails", (roomName) => {
        console.log("CS: Retrieving game details for room " + roomName + ".");
        socket.emit("gameDetails", rooms[roomName].allWords, rooms[roomName].teamAUsers, rooms[roomName].teamBUsers,
            rooms[roomName].teamASpy, rooms[roomName].teamBSpy, rooms[roomName].bombWords, rooms[roomName].neutralWords,
            rooms[roomName].teamASquares, rooms[roomName].teamBSquares, rooms[roomName].startingTeam);
    });

    //Allows a member of a room to request the spymaster role for their team.
    socket.on("requestSpymaster", (user, roomName, teamSpymaster) => {
        console.log("CS: User " + user + " has request spymaster for team " + teamSpymaster + " in room " + roomName + ".");

        //Team A Spymaster.
        if (teamSpymaster === "A") {
            //Successful request.
            if (rooms[roomName].teamASpy === undefined) {
                //Sets the user as the Team A spymaster and emits to all users to update their game details.
                rooms[roomName].teamASpy = user;
                console.log("CS: User " + user + " is now the spymaster for team" + teamSpymaster + " in room " + roomName + ".");
                io.to(roomName).emit("teamASpymaster", user);
            //Failed request.
            } else {
                console.log("CS: User " + user + " was denied spymaster for team" + teamSpymaster + " in room " + roomName + ".");
                socket.emit("spymasterFail")
            }
        //Team B Spymaster.
        } else {
            //Successful request.
            if (rooms[roomName].teamBSpy === undefined) {
                //Sets the user as the Team B spymaster and emits to all users to update their game details.
                rooms[roomName].teamBSpy = user;
                console.log("CS: User " + user + " is now the spymaster for team" + teamSpymaster + " in room " + roomName + ".");
                io.to(roomName).emit("teamBSpymaster", user);
            //Failed request.
            } else {
                console.log("CS: User " + user + " was denied spymaster for team" + teamSpymaster + " in room " + roomName + ".");
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
            console.log("CS: User " + user + " has left team A.");
            rooms[roomName].teamAUsers.splice(teamAIndex, 1);
            rooms[roomName].teamBUsers.push(user);
        //Removes the user from Team B if they wish to swap to Team A
        } else if (teamBIndex > -1) {
            console.log("CS: User " + user + " has left team B.");
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

        console.log("CS: User " + user + " has joined team " + team + ".");

        //Emits to let other room members know of the team change.
        io.to(roomName).emit("teamChange", user, team);
    });

    //Used for when a WordButton has been pressed so that all users can update their game status.
    socket.on("wordButton", (word, username, roomName) => {
        io.to(roomName).emit("wordButton", word, username);
        console.log("CS: Word " + word + " selected in room " + roomName + " by " + username + ".");
    });

    //Used for when a user chooses to end their teams turn.
    socket.on("endTurn", (roomName) => {
        io.to(roomName).emit("endTurn");
        console.log("CS: Turn ending in room " + roomName + ".");
    });

    //Used for when a spymaster gives a hint to their team.
    socket.on("hint", (hint, roomName) => {
        console.log("CS: Hint " + hint + " for room " + roomName + ".");
        io.to(roomName).emit("hint", hint);
    });

    //Used for sending chat messages to the room.
    socket.on("chat", (user, team, message, roomName) => {
        console.log("CS: Message from user " + user + " on team " + team + ": " + message);

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

    //When user disconnects.
    socket.on("disconnect", () => {
        console.log("CS: User has disconnected.");
    })
});

//Hosts the server.
server.listen(8080, () => {
    console.log("CS: Server is listening");
});