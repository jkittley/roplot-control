/**
 * Created by jacob on 04/03/16.
 */

var SocketManager = function(newDataCb) {
    this.connectCbs = [];
    this.disconnectCbs = [];
    this.newDataCbs = [];
    if (newDataCb!==undefined) this.addCallback(this.newDataCbs, newDataCb);
    this.socket = null;
};

SocketManager.prototype.addCallback = function(cbList, cb) {
    if (typeof cb === "function") {
        cbList.push(cb);
        console.log('New callback added');
        console.log(cb);
    } else {
        console.log('New callback error: NOT A FUNCTION');
    }
};


SocketManager.prototype.emit = function(jsonMsg) {
    this.socket.emit('json', jsonMsg);
};

SocketManager.prototype.addConnectCallback = function(cb) {
    this.addCallback(this.connectCbs, cb);
};

SocketManager.prototype.addDisconnectCallback = function(cb) {
    this.addCallback(this.disconnectCbs, cb);
};

SocketManager.prototype.addNewDataCallback = function(cb) {
    this.addCallback(this.newDataCbs, cb);
};

SocketManager.prototype.connect = function(cb) {
    if (cb) this.addConnectCallback(cb);
    this.socket = io.connect('http://' + document.domain + ':' + location.port);
    var self = this;
    this.socket.on('connect', function() {
        console.log('Connected');
        // On connect callbacks
        for (var i in self.connectCbs) self.connectCbs[i](true);
    });
    // On new data callbacks
    this.socket.on('update', function(data) {
        for (var i in self.newDataCbs) self.newDataCbs[i](data);
    });
    // On disconnect callbacks
    this.socket.on('disconnect', function() {
        console.log('Disconnected');
        for (var i in self.disconnectCbs) self.disconnectCbs[i]();
        alert("Connection failed");
    });
};


