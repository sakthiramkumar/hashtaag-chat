var redis = require('redis');
var method = UserRedisClient.prototype;

function UserRedisClient(port, host, options){
	this._port = port;
	this._host = host;
	this._options = options;
	this._client = null;
}

method.connect = function(callback){
	this._client = redis.createClient(this._port, this._host, this._options);
	callback('Connected to redis server');
} 

method.disconnect = function(callback){
	this._client.quit();
	callback('Disconnected from redis server');
}

method.registerUser = function(session, callback){
	var user_object = {name : session.username, socket_id  : session.socket_id, messages : ''};
	this._client.HMSET('user:'+user_object.name, user_object, callback);
}


method.getAllUsers = function(callback){
	var users = [];
	this._client.keys('user:*', function(err, keys){
		for (var i = keys.length - 1; i >= 0; i--) {
			users.push(keys[i].split(':')[1]);
		}
		callback(users);
	});
}

method.deleteUser = function(username, callback){
	this._client.del('user:'+username, function(err,user){
		callback(username);
	});
}

method.getUserDetails = function(username, callback){
	console.log('getting user details ' + 'user:'+username);
	this._client.hgetall('user:'+username, function(err,user){
		if(user != null)
			user.messages = user.messages == '' ? []  : JSON.parse(user.messages);
		callback(user);
	});
	
}

method.addMessagesToUser = function(user, msg, callback){
	if(!user.messages){
		user.messages = [];
	}
	user.messages.push(msg);
	user.messages = JSON.stringify(user.messages);
	this._client.hmset('user:'+user.name, user, callback);
}

module.exports =  UserRedisClient;