# Accessible Codenames Server | Swansea University Third Year Project

The online mode of the game I made for my final year project required a server to be made in order for it to be playable.
The repository for the Android application can be found here: https://github.com/JamieCallan117/Accessible-Codenames

This server is made using the web framework Node.js and uses the Socket.IO library to create rooms which host each lobby for the game and users in the app can join either public rooms which have o password or private rooms which require a password to join.

The server simply passes key words and data between each player in each room and the client listens for those key words and knows what data it should be receiving and handles it from there.
