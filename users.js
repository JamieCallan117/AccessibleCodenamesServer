const users = [];

function userJoin(id, room) {
    const user = { id, room };

    users.push(user);

    return user;
}

function getRoomUsers(room) {
    return users.filter(user => user.room === room);
}

module.exports = { userJoin, getRoomUsers };