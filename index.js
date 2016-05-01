var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var UserRedisClient = require('./lib/UserRedisClient');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var RedisStore = require('connect-redis')(session);

var userRedisClient = new UserRedisClient(6379,'127.0.0.1',{});

app.use(bodyParser());
//app.use(session({ secret: 'keyboard cat', cookie: { maxAge: 60000 }}))

var sessionMiddleware = session({
  store: new RedisStore({
    host: 'localhost',
    port: 6379,
    db: 2,
    pass: ''
  }),
  secret: '1234567890QWERTY'
});



io.use(function(socket, next) {
    sessionMiddleware(socket.request, socket.request.res, next);
});

//app.use(sessionMiddleware);
app.use(connectRedis);
io.use(function(socket, next) {
    connectRedis(socket.request, socket.request.res, next);
});

app.get('/', function(req, res){
  res.sendfile('home.html');
});

app.post('/register', function(req, res){
	var clients = Object.keys(io.engine.clients);
	console.log(req.body);
	userRedisClient.getUserDetails(req.body.username, function(user){
		console.log(user);
		if(user == null)
			res.json({success : true, name : req.body.username, users : clients});
		else{
			res.json({success : false, message : "user name already taken"});
		}
	});
	
});


io.on('connection', function(socket){

  socket.on('disconnect', function(){
  	if(socket.request.session.username){
		deleteUser(socket.request.session.username,function(){
			emitUsersList();
			socket.request.session = {};
		});
	}
    
  });

  socket.on('chat message', function(msg){
  	sendMessage(socket, msg);
  });

  socket.on('unregister', function(username){
  	console.log('unregister called');
  	deleteUser(username,function(){
  		emitUsersList();
  	});
  	socket.request.session = {};
  	
  });

  socket.on('registration-success', function(data){
  	console.log('registration-success called');
  	socket.request.session.socket_id = socket.id;
	socket.request.session.username = data.name;
  	console.log('socket id set');
  	registerUserToRedis(socket.request.session, function(){
  		emitUsersList();
  	});
  });
});

var deleteUser = function(username, callback){
	userRedisClient.deleteUser(username, function(username){
		console.log(callback);
  		callback();
  		console.log(username + 'has been deleted');
  	});
}

var emitUsersList = function(){
	getAllUsers(function(users){
  		io.emit('users-list', users);
  	});
}

var sendMessage = function(socket, chatMessage){
	chatMessage.time = new Date();
	console.log(chatMessage);
	userRedisClient.getUserDetails(chatMessage.recipient, function(user){
		userRedisClient.addMessagesToUser(user, chatMessage, function(result){
			if (io.sockets.connected[user.socket_id]) {
		    	io.sockets.connected[user.socket_id].emit('chat message', chatMessage);
		    	socket.emit('chat message', chatMessage);
			}
		})
	});
}


var registerUserToRedis = function(session, callback){
	console.log('registering user ')
	console.log('session');
	userRedisClient.registerUser(session, callback);
}

var getAllUsers = function(callback){
	userRedisClient.getAllUsers(callback);
}


function connectRedis(req,res,next){
	userRedisClient.connect(function(result){
 		console.log(result);
 		next();
	});
}

http.listen(3000, function(){
  console.log('listening on *:3000');
});