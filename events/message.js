module.exports = {
	name: 'message',
	execute(message) {
        // if ()
		return console.log(`${message.author.tag} in #${message.channel.name} sent: ${message.content}`);
	},
};