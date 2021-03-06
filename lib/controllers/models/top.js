'use strict';

var database = require("../database/driver");
var db =database.connect();
var mail = require('../mailserver');

exports.checkTop = function(req, res) {
  console.log('[top.js] GET checkTop');
  console.log("{current userId: "+req.param("userId")+" ; timestamp: "+req.param("timestamp")+"}");
  var userId = parseInt(req.param("userId"));
  var timestamp = parseInt(req.param("timestamp"));
  //userId
  //timestamp
  var timestampDelta = 5000;

  //db.collection('tops').find({"timestamp":parseInt(req.param("timestamp")),"firstUser":{$ne:userId}}).toArray(function(err, result) {
  var timestampMax=timestamp+timestampDelta;
  var timestampMin=timestamp-timestampDelta;

  //db.collection('tops').find({"timestamp":timestamp}).toArray(function(err, result) {
  db.collection('tops').find({"timestamp":{ $gte: timestampMin , $lt: timestampMax}}).toArray(function(err, result) {
    if (err){
      res.status(500).json({error:3});
    }else{

      //User A: First request between the 2 parallel requests
      if(result==0){ 
        //We save then the first request with the specific timestamp and the user id
        db.collection('tops').save({"case":1,'firstUser':userId,"timestamp":timestamp}, function(err) {   
          if (err) {
            throw err;
            console.log("[top.js] error:"+err);
            res.status(500).json({error:1});
          }else {
            console.log("[top.js]: top added");
            res.status(200).json({"case":1});
            //The user must retry a call in 1 second 
          }
        }); 
      
      }else{//result=1 or 2
        timestamp=result[0].timestamp;
        if(result[0].firstUser==userId){
          //User A: Second Call
          //need to get User b id -> Present if case=3 else retry
          if(result[0].case == 3){
            db.collection('users').find({"userId":result[0].secondUser}).toArray(function(err, rest) {
              if (err){
                res.status(500).json({error:3});
              }else{

                  //If secondUser is a terminal, send firstUser an email
                  console.log("Checking for user type of secondUser: "+ rest[0].type);
                  if(rest[0].type=="terminal"){
                    //send mail to firstUser->userId
                    console.log("Trying to send an email...");
                    mail.sendMailToUser(userId)
                  }

                //Second user data
                res.status(200).json({"case":3,"id":result[0].secondUser,"name":rest[0].name,"surname":rest[0].surname,"email":rest[0].email,"type":rest[0].type});
                //Can delete node here
                db.collection('tops').remove({"timestamp":timestamp},function(){});
              }
            });

          }else{
            //Still waiting for User B
            res.status(200).json({"case":1});
            //The user must retry a call in 1 second 
          }

        }else{
          //User B: Second request between the 2 parallel requests        
          db.collection('tops').update({'timestamp':timestamp},{$set:{'secondUser':userId,'case':3}}, function(err, recordCount) { 
            if (err) {
              throw err;
              console.log("[top.js] error:"+err);
              res.status(500).json({error:1});
            }else {
              //console.log("[top.js]: " + recordCount + " top updated by User B");
              
              db.collection('users').find({"userId":parseInt(result[0].firstUser)}).toArray(function(err, rest) {
                if (err){
                  res.status(500).json({error:3});
                }else{
                  
                  //If firstUser is a terminal, send secondUser an Email 
                  console.log("Checking for user type of firstUser: "+ rest[0].type);
                  if(rest[0].type=="terminal"){
                    //send mail to secondUser->userId
                    console.log("Trying to send an email...");
                    mail.sendMailToUser(userId)
                  }

                  console.log("Server response"+ JSON.stringify(rest));
                  //First user data
                  res.status(200).json({"case":2,"id":result[0].firstUser,"name":rest[0].name,"surname":rest[0].surname,"email":rest[0].email,"type":rest[0].type});
                }
              });

            }
          }); 

        }

      }

    }       
  }); 


};