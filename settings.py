from tinydb import TinyDB, Query
from unipath import Path
import os
from flask_wtf import Form
from wtforms import StringField, IntegerField, HiddenField, TextField, SelectField
from wtforms.validators import DataRequired, NumberRange
import pickledb

db = TinyDB(Path(os.path.realpath(__file__)).parent.child('settings.json'))
ba = pickledb.load(Path(os.path.realpath(__file__)).parent.child('settings.db'), False)

class Settings:

    defaults = {
        "rotationSpeed": 10,
        "beltSpeed": 10,
        "physicalRadius": 1200,
        "physicalDrawStart": 200,
        "physicalDrawEnd": 1000
    }


    def getAll(self):
        out = {}
        for key, value in self.defaults.iteritems():
            val = self.get(key)
            out[key] = val
        return out


    def get(self, settingName):
        r = ba.get(settingName)
        if r is not None:
            return r
        else:
            self.set(settingName, self.defaults[settingName])
            return self.defaults[settingName]

    def set(self, settingName, value):
        r = ba.set(settingName, value)
        ba.dump()
        return r



    # Get tables

    def getGeneralTable(self):
        tb = db.table('basics')
        tb.clear_cache()
        return tb

    def getCarriagesTable(self):
        return db.table('carriages')

    def getPensTable(self):
        return db.table('pens')


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
    general = HiddenField('general')
    rotationSpeed     = IntegerField('Rotation Speed',      validators=[DataRequired(), NumberRange(0,1000)])
    beltSpeed         = IntegerField('Belt Speed',          validators=[DataRequired(), NumberRange(0,1000)])
    physicalRadius    = IntegerField('Boom Radius',         validators=[DataRequired(), NumberRange(100,10000)])
    physicalDrawStart = IntegerField('Draw Start',          validators=[DataRequired(), NumberRange(0,10000)])
    physicalDrawEnd   = IntegerField('Draw End',            validators=[DataRequired(), NumberRange(0,10000)])


class SettingsCarriageForm(Form):
    carriages   = HiddenField('carriages')
    carriage_id = IntegerField('ID', validators=[DataRequired(), NumberRange(0, 10000)])
    beltpos     = IntegerField('Belt Position', validators=[DataRequired(), NumberRange(0, 10000)])


class SettingsPenForm(Form):
    pole_choices = [('north', 'North'), ('south', 'South')]
    color_choices = [('red', 'Red'), ('green', 'Green'), ('blue', 'Blue'), ('black', 'Black'),
                             ('orange', 'Orange')]
    pen     = HiddenField('pen')
    pen_id  = IntegerField('ID', validators=[DataRequired(), NumberRange(0, 1000)])
    carriage_id = SelectField('Carriage', choices=[])
    name    = StringField('Name', validators=[DataRequired()])
    color   = SelectField('Colour', choices=color_choices)
    pole    = SelectField('Pole', choices=pole_choices)
    xoffset = IntegerField('X offset', validators=[DataRequired(), NumberRange(-100, 100)])

    def pre_validate(self, form=None):
        print form
        if form is not None:
            print form