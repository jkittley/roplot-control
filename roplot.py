import socket
import sys
import signal
from flask import Flask
from flask import render_template, url_for
from flask_socketio import SocketIO, send, emit

app = Flask(__name__)
app.config['DEBUG'] = True
socketio = SocketIO(app)

@app.route('/')
def index():
    return render_template('plotter.html')

@socketio.on('message')
def handle_message(message):
    print('received message: ' + str(message))
    # send_json({ message: True })

@socketio.on('json')
def handle_message(json):
    print('received message: ' + str(json))
    # send_json(json)


@app.route('/test')
def to_software():
    socketio.emit('update', "TEST")
    return "Test message sent to software"

if __name__ == '__main__':
    WEB_SERVER = {
        "host": "localhost",
        "protocol": "http",
        "port": 8000
    }
    app.use_reloader = False
    socketio.run(app, port=WEB_SERVER['port'], host=WEB_SERVER['host'])


def signal_handler(signal, frame):
    print('You pressed Ctrl+C!')
    socketio.server.stop()
    sys.exit(0)
signal.signal(signal.SIGINT, signal_handler)