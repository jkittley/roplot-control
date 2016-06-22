import glob, serial, time, signal, sys, json, click
import random
import requests
from socketIO_client import SocketIO, LoggingNamespace
from termcolor import colored

SECRET_KEY = 'MY_SECRET_KEY'
# Interval between samples (in milliseconds)
SAMPLE_INTERVAL = 200
# Serial rate
SERIAL_RATE = 9600
# Time to wait for connection to establish (in seconds)
CONNECTION_TIMEOUT = 10
# After connection established time to wait for init (in seconds)
CONNECTION_WAIT = 2

socketCon = None
serialCon = None
test = { 'x':0, 'y':0 }
server_settings = None

# Helper functions to colour text output to command line
def concat_args(*arg):
    s = ""
    for a in arg:
        s = s + " " + str(a)
    return s


def titlemsg(*arg):
    print(colored(concat_args(*arg), 'yellow'))


def errmsg(*arg):
    print(colored(concat_args(*arg), 'red'))


def infomsg(*arg):
    print(colored(concat_args(*arg), 'blue'))


def optionmsg(*arg):
    print(colored(concat_args(*arg), 'blue'))


def jsonmsg(*arg):
    print(colored(concat_args(*arg), 'cyan'))


def listen_command(*args):
    d = args[0]
    jsonmsg(d)

    # if 'move_selected' in d:
    #     dir = "no idea"
    #     serialCon.write(dir + "\n")
    #     infomsg(dir)

    if 'advisor2' in d:
        dir = str(d['advisor2']['chosen'])
        serialCon.write(dir+"\n")
        infomsg(dir)

def init_listeners():
    if socketCon is not None:
        socketCon.on('update', listen_command)
        socketCon.wait()
    else:
        errmsg("Socket not connected")



# List all available serial ports
def list_serial_ports():
    # Find ports
    if sys.platform.startswith('win'):
        ports = ['COM%s' % (i + 1) for i in range(256)]
    elif sys.platform.startswith('linux') or sys.platform.startswith('cygwin'):
        # this excludes your current terminal "/dev/tty"
        ports = glob.glob('/dev/tty[A-Za-z]*')
    elif sys.platform.startswith('darwin'):
        ports = glob.glob('/dev/tty.*')
    else:
        raise EnvironmentError('Unsupported platform')
    # Test all discovered ports and only return those where a connection could be established
    result = []
    for port in ports:
        if test_port(port):
            result.append(port)
    return result

# Test if a connection to a port can be established
def test_port(port):
    try:
        s = serial.Serial(port)
        s.close()
        return True
    except (OSError, serial.SerialException):
        return False

# Manual input for port
def manual_port_picker(ports):
    # Print option
    port_number = 1
    for port in ports:
        optionmsg(port_number, port)
        port_number+=1
    optionmsg('R', "Refresh")
    optionmsg('E', "Exit")

    # Wait for answer
    while True:
        try:
            answer = str(raw_input('Please select a port: '))
            if answer.lower() == 'e':
                sys.exit(0)
            if answer.lower() == 'r':
                ports = list_serial_ports()
                return manual_port_picker(ports)

            return ports[int(answer)-1]
        except (IndexError, UnicodeDecodeError, ValueError):
            errmsg('Invalid choice please try again.')


# Test for web server
def test_for_webserver():
    url = server_settings['protocol'] + "://" + server_settings['host']+":"+str(server_settings['port'])
    infomsg('Testing connection to: ', url)
    try:
        r = requests.get(url)
    except requests.exceptions.ConnectionError:
        return False

    if r.status_code == 200:
        return True
    else:
        return False

# Configure web socket
def config_websocket():
    # Test web server exists
    server_exists = test_for_webserver()
    if not server_exists:
        errmsg("Failed to connect to web server, is it running?")
        sys.exit(0)

    # Connect to web socket
    infomsg('Connecting to socket')

    socketCon = SocketIO('localhost', server_settings['port'], LoggingNamespace)

    while not socketCon.connected:
        infomsg("Waiting for connection")
        time.sleep(CONNECTION_WAIT)

    infomsg('Connected to socket')
    socketCon.emit('json', {'robot': 'connected'})
    socketCon.wait(seconds=1)

    return socketCon


# Configure Serial connection
def config_serial():
    # List ports
    ports = list_serial_ports()
    port = None

    # If no port auto picked or auto pick off then manual pick
    port = manual_port_picker(ports)

    # Serial
    infomsg('Connecting to serial port')
    serialCon = serial.Serial(port, SERIAL_RATE, timeout=CONNECTION_TIMEOUT)
    while not serialCon.isOpen():
        infomsg("waiting for connection")
        time.sleep(CONNECTION_WAIT)

    return serialCon




# -----------------------------------------------------------------------------

# Detect when script terminated and close socket
def signal_handler(blah, given_signal):

    if serialCon is not None:
        try:
            serialCon.close()
        except serial.serialutil.SerialException:
            errmsg("Failed to close serial")

    infomsg('Closing connections...')
    if socketCon is not None:
        socketCon.disconnect()

    infomsg('Exited')
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)


if __name__ == '__main__':
    server_settings = {
        "host": "localhost",
        "protocol": "http",
        "port": 8000
    }
    titlemsg(">>>> Serial Port Monitor <<<<")

    # Config serial
    serialCon = config_serial()

    # Config websocket
    socketCon = config_websocket()
    init_listeners()

    # Start
    infomsg('Starting...')









# -----------------------------------------------------------------------------
