#! /usr/bin/env node

(async () => {

    async function emptyS3Directory(bucket) {
        const listedObjects = await s3.listObjectsV2({ Bucket: bucket }).promise();
        if (listedObjects.Contents.length === 0) return;
    
        const deleteParams = {
            Bucket: bucket,
            Delete: { Objects: [] }
        };
        listedObjects.Contents.forEach(({ Key }) => {
            deleteParams.Delete.Objects.push({ Key });
        });
    
        await s3.deleteObjects(deleteParams).promise();
    
        if (listedObjects.IsTruncated) await emptyS3Directory(bucket, dir);
    }

    async function emptyS3DirectoryVersions(bucket) {
        const listedObjects = await s3.listObjectVersions({ Bucket: bucket, MaxKeys: 1000 }).promise();
        if ((listedObjects.Versions.length + listedObjects.DeleteMarkers.length) === 0) return;
        
        const deleteParams = {
            Bucket: bucket,
            Delete: { Objects: [] }
        };

        for (let i=0; i<listedObjects.Versions.length; i++) {
            deleteParams.Delete.Objects.push({ Key: listedObjects.Versions[i].Key, VersionId: listedObjects.Versions[i].VersionId });
        }
        for (let i=0; i<listedObjects.DeleteMarkers.length; i++) {
            deleteParams.Delete.Objects.push({ Key: listedObjects.DeleteMarkers[i].Key, VersionId: listedObjects.DeleteMarkers[i].VersionId });
        }

        await s3.deleteObjects(deleteParams).promise();
        if (listedObjects.IsTruncated) await emptyS3Directory(bucket, dir);
    }

    async function listS3Directory(bucket) {
        const listedObjects = await s3.listObjectsV2({ Bucket: bucket }).promise();
        if (listedObjects.Contents.length === 0) return;
        console.log(listedObjects.Contents.length + " objects found");
        listedObjects.Contents.forEach(({ Key }) => {
            console.log(" - " + Key);
        });
    }

    async function countFiles(bucketName) {
      try {
        const listedObjects = await s3.listObjectsV2({ Bucket: bucketName }).promise();
        return listedObjects.Contents.length;
      } catch {
        return -1;
      }
    };

    function padding(length, char) {
      let s = "";
      for (let i=0; i<length; i++) {
        s += char;
      }
      return s;
    }

    async function dumpMenu(bucketsListing) {
      let maxLength = 0;
      bucketsListing.forEach(bucket => {
        maxLength = Math.max(maxLength, bucket.name.length);
      });
      if ((maxLength % 2) == 1) {
        maxLength++;
      }
      
      //Print the header
      const pad = padding((maxLength / 2) - 6, " ");
      out(" ID " + pad + "Bucket Name " + pad + "  Size ");
      out(padding(maxLength + 12, "-"));

      bucketsListing.forEach(bucket => {
        let line = "";
        if (bucket.id < 10) {
          line += " ";
        };

        const sizeSize = bucket.numFiles.toString().length;
        line += bucket.id + ". " + bucket.name + padding((maxLength - bucket.name.length) + (7 - sizeSize), " ");
        if (bucket.numFiles > -1) {
          line += bucket.numFiles;
        } else {
          line += " -";
        }
        out(line);        
      });
    }

    async function readBuckets(s3) {
      let buckets = [];
      const listBucketsResponse = await s3.listBuckets({}).promise();
  
      let bucketId = 0;
      for (let i=0; i<listBucketsResponse.Buckets.length; i++) {
        const bucket = listBucketsResponse.Buckets[i];
        if (!bucket.Name.includes("do-not-delete")) {
          bucketId++;
          const numFiles = await countFiles(bucket.Name);
          buckets.push(
            {
              id: bucketId,
              name: bucket.Name,
              numFiles: numFiles
            }
          );
        }
      }
      return buckets;
    }

    /**************************
     * Setup Console ReadLine *
     *************************/
    const readline = require('readline');
    const { promisify } = require('util');
    
    
    readline.Interface.prototype.question[promisify.custom] = function(prompt) {
        return new Promise(resolve =>
          readline.Interface.prototype.question.call(this, prompt, resolve),
        );
    };
    readline.Interface.prototype.questionAsync = promisify(
        readline.Interface.prototype.question,
    );

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const out = console.log;

    /**************************
     * Intro and Heading      *
     *************************/

    out("===================================================");
    out(" ___ ____  ___         _       _     _   _ _   _ _ ");
    out("/ __|__ / | _ )_  _ __| |_____| |_  | | | | |_(_) |");
    out("\\__ \\|_ \\ | _ \\ || / _| / / -_)  _| | |_| |  _| | |");
    out("|___/___/ |___/\\_,_\\__|_\\_\\___|\\__|  \\___/ \\__|_|_|");
    out("----------------------- v1.0 ----------------------");  
    out();

    /**************************
     * Determine credentials  *
     *************************/

    const profile = "";
    const envAccessKey = process.env.AWS_ACCESS_KEY_ID;

    if ((envAccessKey === undefined) || (envAccessKey === "")) {
      try {
        profile = await rl.questionAsync("Enter your profile name [default]: ");
        if (profile == "") {
            profile = "default";
        }
      } catch (err) {
          console.log("Error: " + err);
      }

      console.log("Using profile: " + profile)
    } else {
      console.log("Using environment credentials");
    }
    
    const aws = require('aws-sdk');
    if (profile != "") {
      const credentials = new aws.SharedIniFileCredentials({profile: profile});
      aws.config.credentials = credentials;
    }

    /**************************
     * Read buckets listing   *
     *************************/
    const s3 = new aws.S3();
    let buckets = await readBuckets(s3);
    
    let running = true;
    while (running) {
      if (buckets.length == 0) {
        out("----> There are no buckets to work on <----");
        running = false;
        break;
      }      
      
      out();
      dumpMenu(buckets);
      
      let action = await rl.questionAsync("Command: ");
      action = action.toLowerCase();
    
      if ((action == "?") || (action == "help") || (action == "")) {
        out("Enter command and bucket number: eg delete 1 or d 1 or l1");
        out("Valid commands are: delete, empty, list, help, refresh or quit")
      } else if ((action == "q") || (action == "quit")) {
        running = false;
      } else if ((action == "r") || (action == "refresh")) {
        out("==> Refreshing bucket listing <==");
        buckets = await readBuckets(s3);
      } else {
                
        let spacePos = action.indexOf(" ");
        if (spacePos == -1) {
          spacePos = 0
        }
        let bucketId = parseInt(action.substr(spacePos + 1));
        let bucket = buckets.find(b => b.id == bucketId);
        action = action.substr(0, spacePos + 1).trim();

        if ((action == "delete") || (action == "d")) {
          if (bucket.numFiles > 0) {
            out("==> Cannot delete a non-empty bucket <==");  
          } else {
            out("==> Deleting bucket " + bucket.name + "...");
          
            try {
              await s3.deleteBucket({ Bucket: bucket.name }).promise();
              buckets = buckets.filter(r => r.id != bucket.id);

              out("----> Done <----");
            } catch (err) {
              out("----> Error occured while deleteing bucket: " + err + " <----");
            }
          }
        } else if ((action == "list") || (action == "l")) {
          if (bucket.numFiles == 0) {
            out("==> Cannot list an empty bucket <==");  
          } else {
            out("==> Listing bucket " + bucket.name + "...");
          
            try {
              await listS3Directory(bucket.name);
              out("----> Done <----");
            } catch (err) {
              out("----> Error occured while listing bucket: " + err + " <----");
            }
          }
        } else if ((action == "empty") || (action == "e")) {
          if (bucket.numFiles == 0) {
            out("==> Cannot empty an empty bucket <==");  
          } else {
            out("==>  Emptying bucket " + bucket.name);
            try {
              await emptyS3Directory(bucket.name);
              await emptyS3DirectoryVersions(bucket.name);
              bucket.numFiles = 0;
              out("----> Done <----");
            } catch (err) {
              out("----> Error occured while emptying bucket: " + err + " <----");
            }
          }
        }
      }
    }
    out("Quiting...");
    rl.close();    
})();