from tinydb import TinyDB, Query
from unipath import Path
import os
from flask_wtf import Form
from wtforms import StringField, IntegerField, HiddenField, TextField, SelectField
from wtforms.validators import DataRequired, NumberRange

class Settings:

    db = TinyDB(Path(os.path.realpath(__file__)).parent.child('settings.json'))

    defaults = [
        ("rotationSpeed", 10),
        ("beltSpeed", 10),
        ("physicalRadius", 1200),
        ("physicalDrawStart", 200),
        ("physicalDrawEnd", 1000)
    ]

    def __init__(self):
        self.initData()
        self.removeNotInDefault()


    def initData(self):
        for setting in self.defaults:
            table = self.getGeneralTable()
            q = Query()
            c = table.count(q.type==setting[0])
            # If there is more than one version of the setting then remove all and return to default
            if c > 1:
                print "Error multiple versions of "+str(setting[0])+" found. Deleting all"
                table.remove(q.type==setting[0])
                c = 0
            if c == 0:
                print "Creating setting from defaults"
                table.insert({'type': setting[0], 'value': setting[1]})


    def removeNotInDefault(self):
        table = self.getGeneralTable()
        settingNames = [str(i[0]) for i in self.defaults]
        q = Query()
        for s in self.db.all():
            if s['type'] not in settingNames:
                print "Invalid setting ", s['type']
                table.remove(q.type == s['type'])


    def getAll(self):
        table = self.getGeneralTable()
        return table.all()


    def get(self, settingName):
        table = self.getGeneralTable()
        q = Query()
        try:
            return table.search(q.type == settingName)[0]['value']
        except IndexError:
            return None

    def set(self, settingName, value):
        table = self.getGeneralTable()
        q = Query()
        if table.count(q.type==settingName) == 1:
            print table.update({'value': int(value)}, q.type==str(settingName))
            return True
        else:
            print "Invalid setting"
            return False



    # Get tables

    def getGeneralTable(self):
        return self.db.table('basics')

    def getCarriagesTable(self):
        return self.db.table('carriages')

    def getPensTable(self):
        return self.db.table('pens')


    # Carriages

    def addCarriage(self, id, beltpos):
        table = self.getCarriagesTable()
        table.insert({ "id": id, "beltpos": beltpos })

    def updateCarriage(self, id, beltpos):
        table = self.getCarriagesTable()
        q = Query()
        table.update({"beltpos": beltpos}, q.id == id)

    def addUpdateCarriage(self, id, beltpos):
        table = self.getCarriagesTable()
        q = Query()
        c = table.count(q.id == id)
        print c
        if c == 1:
            return self.updateCarriage(id, beltpos)
        elif c > 1:
            table.remove(q.id==id)
        return self.addCarriage(id, beltpos)


    def getCarriages(self):
        table = self.getCarriagesTable()
        return table.all()


    def removeCarriage(self, carriage_id):
        table = self.getCarriagesTable()
        q = Query()
        table.remove(q.id==int(carriage_id))


    # Pens

    def addPen(self, penId, carriageid, name, color, pole, xoffset):
        table = self.getPensTable()
        table.insert({
            'id': penId,
            'carriageId': carriageid,
            'name': name,
            'color': color,
            'pole': pole,
            'xoffset': xoffset,
        })

    def updatePen(self, penId, carriageid, name, color, pole, xoffset):
        table = self.getPensTable()
        q = Query()
        table.update({
            'id': penId,
            'carriageId': carriageid,
            'name': name,
            'color': color,
            'pole': pole,
            'xoffset': xoffset,
        }, q.id == penId)


    def addUpdatePen(self, penId, carriageid, name, color, pole, xoffset):
        table = self.getPensTable()
        q = Query()
        c = table.count(q.id == penId)
        if c == 1:
            return self.updatePen(penId, carriageid, name, color, pole, xoffset)
        elif c > 1:
            table.remove(q.id == id)
        return self.addPen(penId, carriageid, name, color, pole, xoffset)


    def getPens(self, **kwargs):
        table = self.getPensTable()
        carriage_id = kwargs.get('carriage_id', None)
        if carriage_id is None:
            return table.all()
        else:
            q = Query()
            return table.search(q.carriageId==str(carriage_id))

    def removePen(self, pen_id):
        table = self.getPensTable()
        q = Query()
        table.remove(q.id == int(pen_id))


class SettingsForm(Form):
    s = Settings()
    general = HiddenField('general')
    rotationSpeed     = IntegerField('Rotation Speed', default=s.get('rotationSpeed'),      validators=[DataRequired(), NumberRange(0,1000)])
    beltSpeed         = IntegerField('Belt Speed',     default=s.get('beltSpeed'),          validators=[DataRequired(), NumberRange(0,1000)])
    physicalRadius    = IntegerField('Boom Radius',    default=s.get('physicalRadius'),     validators=[DataRequired(), NumberRange(100,10000)])
    physicalDrawStart = IntegerField('Draw Start',     default=s.get('physicalDrawStart'),  validators=[DataRequired(), NumberRange(0,10000)])
    physicalDrawEnd   = IntegerField('Draw End',       default=s.get('physicalDrawEnd'),    validators=[DataRequired(), NumberRange(0,10000)])


class SettingsCarriageForm(Form):
    s = Settings()
    carriages   = HiddenField('carriages')
    carriage_id = IntegerField('ID', validators=[DataRequired(), NumberRange(0, 1000)])
    beltpos = IntegerField('Belt Position', validators=[DataRequired(), NumberRange(0, s.get('physicalRadius'))])

class SettingsPenForm(Form):
    s = Settings()
    pole_choices  = [('north', 'North'), ('south', 'South')]
    color_choices = [('red', 'Red'), ('green', 'Green'), ('blue', 'Blue'), ('black', 'Black'), ('orange', 'Orange')]
    carriage_choices = [ (str(x['id']), str(x['id'])) for x in s.getCarriages()]


    pen     = HiddenField('pen')
    pen_id  = IntegerField('ID', validators=[DataRequired(), NumberRange(0, 1000)])
    carriage_id = SelectField('Carriage', choices=carriage_choices)
    name    = StringField('Name', validators=[DataRequired()])
    color   = SelectField('Colour', choices=color_choices)
    pole    = SelectField('Pole', choices=pole_choices)
    xoffset = IntegerField('X offset', validators=[DataRequired(), NumberRange(-100, 100)])

