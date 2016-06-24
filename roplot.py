from settings import Settings, SettingsForm, SettingsCarriageForm, SettingsPenForm
import sys
import signal
from flask import Flask, request
from flask import render_template
from flask_socketio import SocketIO

app = Flask(__name__)
app.config['DEBUG'] = True
app.secret_key = 'A0Zr98j/3yX R~XHH!jmN]LWX/,?RT'

socketio = SocketIO(app)


#
# PAGES
#

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/control')
def control():
    return render_template('plotter.html')

@app.route('/settings', methods=['GET', 'POST'])
def editSettings():

    # Settings = getDB()
    settings = Settings()
    form = SettingsForm()
    carriageForm = SettingsCarriageForm()
    penForm = SettingsPenForm()

    if 'general' in request.form:
        if form.validate_on_submit():
            for f in form:
                settings.set(f.name, f.data)

    if 'carriages' in request.form:
        print "Carriage form"
        if carriageForm.validate_on_submit():
            settings.addUpdateCarriage(carriageForm.carriage_id.data, carriageForm.beltpos.data)

    if 'pen' in request.form:
        print "penForm form"
        if penForm.validate_on_submit():
            settings.addUpdatePen(penForm.pen_id.data, penForm.carriage_id.data, penForm.name.data, penForm.color.data, penForm.pole.data, penForm.xoffset.data)


    carriages = settings.getCarriages()
    pens = settings.getPens()
    return render_template('settings.html', form=form, carriages=carriages, pens=pens, carriageForm=carriageForm, penForm=penForm)


#
# SOCKETS
#

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

#
# MAIN
#

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

