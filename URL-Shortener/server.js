const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dns = require('dns');
const mongoose = require('mongoose');
const {Schema} = mongoose;
const app = express();

app.use(cors());

// Basic Configuration
const port = process.env.PORT || 3000;

app.use('/public', express.static(`${process.cwd()}/public`));

app.use('/api/shorturl', bodyParser.urlencoded({extended: false}));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

mongoose.connect(process.env.MONGO_URI);
let URLSchema = new Schema({
  original_url: {type: String, required: true},
  short_url: {type: Number, required: true}
}, {versionKey: false});
const URLModel = mongoose.model("URLModel", URLSchema);
let documentCount;
URLModel.countDocuments({}, (err, count) => {
  (err != null) ? console.error(err) : documentCount = count;
  console.log("The number of documents is", documentCount);
});

let regex = /(^[http[s*]*[:*][\/]*[www.]*)([^\/]*)(.*)/;
let url;

app.post('/api/shorturl', (req, res, next) => {
  console.log(req.body);
  console.log(req.body.url);
  if(req.body.url != null) {
    //First, build a string version the dns can understand.
    url = req.body.url;
    let dnsURL = req.body.url.replace(regex, "$2");
    if(dnsURL == "") return res.json({error: "Invalid URL"});
    //
    console.log("Checking URL: ", dnsURL);
    dns.lookup(dnsURL, (err, _) => {
      if(err != null) {
        console.log("No URL found!");
        return res.json({error: "Invalid URL"});
      }
        next(); //Either error out or go next
    });
  } else {
    next();
  }
},(req, res) => {
  //New change: Do not modify URL after checking. Keep everything!
  let mongoURL = URLModel.findOne({original_url: url}).select('-_id').exec((err, data) => {
    if(err != null) {
      console.log("Error while searching!");
      return res.json({error: "Invalid URL"});
    }
    if(data == null) {
      URLModel.create({original_url: url, short_url: ++documentCount}, (err, data) => {
        if(err != null) {
          return res.json({error: err});
        } else {
          let returnJSON = {original_url: data['original_url'], short_url: data['short_url']};
          return res.json(returnJSON);
        }
      });
    } else {
      return res.json(data);
    }
  });
});

app.get('/api/shorturl/:short_url', (req, res, next) => {
  console.log("Value requested for GET:", req.params.short_url);
  if(isNaN(req.params.short_url) || Number(req.params.short_url) == 0) { //Handle non-number inputs
    return res.json({error: "Wrong format"});
  }
  let mongoURL = URLModel.findOne({short_url: req.params.short_url}, (err, data) => {
    if(err != null) {
      console.log("Invalid formatting");
      return res.json({error: "Wrong format"});
    }
    if(data == null) {
      console.log("No url for number");
      return res.json({error: "No short URL found for the given input"});
    }
    console.log("Found it: ", data);
    return res.redirect(data.original_url);
  });
})

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
