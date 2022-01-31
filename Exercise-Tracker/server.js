const express = require('express')
const app = express()
const cors = require('cors')
const mongoose = require('mongoose')
const {Schema} = mongoose; //Get Schema class from mongoose


//Connect to self mongo server
mongoose.connect(process.env.MONGO_URI);

app.use(express.json()); //Use express JSON parser
app.use(express.urlencoded({extended: false})); //Parse urlencoded strings
app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

const exerciseSchema = new Schema({
  description: {type: String, required: true},
  duration: {type: Number, required: true},
  date: String
});

const userSchema = new Schema({
  username: {type: String, required: true}, //Whoops, didn't mean to init as array
  log: [exerciseSchema] //Multiple schemas!
});

const userModel = new mongoose.model('user', userSchema);

//2 POST handlers -> to /api/users, /api/users/:_id/exercices
app.post('/api/users', (request, response) => {
  userModel.findOne({username: request.body.username}, (err, data) => {
    if(err != null) return response.json({error: err});
    if(data == null) { //Create new user if they don't exist.
        userModel.create({username: request.body.username}, (err, data) => {
          if(err != null) return response.json({error: err});
          return response.json({username: data.username,
          _id: data["_id"]});
        });
    } else { //Send the user if they do exist.
        return response.json({username: data.username, _id: data["_id"]});
    }
  });
});

app.post('/api/users/:_id/exercises', (req, res) => {
  if(req.body.duration == null) return res.json({error: "Duration is a required field"});
  if(req.body.description == null) return res.json({error: "Description is a required field"});
  let date = req.body.date;
  if(date == null || date == '') {
    date = new Date();
    date = date.setDate(date.getDate() - 1);
  }
  try {
      date = new Date(date).toDateString();
    } catch(e) {
      return res.json({error: e});
    }
  const newExercise = {
    description: req.body.description,
    duration: req.body.duration,
    date: date
   }
  userModel.findOneAndUpdate({_id: req.params["_id"]}, {$push: {log: newExercise}}, {new: true}, (err, data) => {
    if(err != null) return res.json({error: err});
    let defaultData = {username: data.username, 
      _id: data["_id"],
      description: newExercise.description,
      duration: parseInt(newExercise.duration),
      date: newExercise.date
      };
    return res.json(defaultData);
  });
});

//2 GET handlers -> to /api/users, /api/users/:_id/logs
//Logs should also handle to, from, and limit params for how many exercises to return

//General get all users.
app.get('/api/users', (req, res) => {
  userModel.find({}).select('-log -__v').exec((err, data) => {
    if(err != null) return res.json({error: err});
    return res.json(data);
  });
});

//Find a specific user
app.get('/api/users/:_id/logs', (req, res) => { //Lean allows for return to normal json :)
userModel.findOne({_id: req.params["_id"]}).lean().exec((err, data) => {
    if(err != null) return res.json({error: err});
    if(data == null) return res.json({error: "No data for this user exists"});
    data.count = data.log.length;
    let logs = [];
    let limit, toDate, fromDate;
    if(req.query.limit != null) limit = req.query.limit;
    if(req.query.to != null) toDate = new Date(req.query.to);
    if(req.query.from != null) fromDate = new Date(req.query.from);
    for(let i = 0; i < data.count; i++) {
      if(limit != undefined && logs.length >= limit) break; //Break as first line of defence
      let exerciseDate = new Date(data.log[i]["date"]);
      if(fromDate == undefined || exerciseDate >= fromDate) {
        if(toDate == undefined || exerciseDate <= toDate) {
          data.log[i]["date"] = exerciseDate.toDateString();
          logs.push(data.log[i]);
        }
      }
    } //Just do a standard for loop since we have a lot of params to go through and a lot of moving parts.
    //TODO: Replace the unsightly for loop with functional filters.
    data.log = logs; //Replace the log with the logs we want.
    return res.json(data);
  });
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
