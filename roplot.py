from flask import Flask
from flask import render_template, url_for
from tinydb import TinyDB, Query

app = Flask(__name__)


@app.route('/')
def index():
    return render_template('plotter.html')

@app.route('/settings')
def getDrawSettings():
    db = TinyDB('settings.json')
    db.all()
    return db.all()


@app.route('/init')
def init():
    db = TinyDB('settings.json')
    db.insert({'type': 'apple', 'count': 7})
    return "init DB"

if __name__ == '__main__':
    app.config['DEBUG'] = True
    app.run()
