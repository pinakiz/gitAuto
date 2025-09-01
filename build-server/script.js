const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const {S3Client , PutObjectCommand} = require('@aws-sdk/client-s3')
const mime = require('mime-types');
const {Kafka} = require('kafkajs')
const { Pool } = require('pg');

require('dotenv').config();

const ProjectId = process.env.PROJECTID;
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID

const TOPIC_NAME = "";

const pool = new Pool({
    connectionString: "", 
});


const kafka = new Kafka({
    clientId: '',
    brokers: [""],
    ssl: {
        ca: [fs.readFileSync(path.join(__dirname,'ca.pem'),'utf-8')],
        rejectUnauthorized: true
    },
    sasl: {
        username: '',
        password: '',
        mechanism: ''
    },
    connectionTimeout: 10000, // 10 seconds
    authenticationTimeout: 10000,
    retry: {
        initialRetryTime: 100,
        retries: 8
    }
});

const producer = kafka.producer({});

const s3Client = new S3Client({
    region : '',
    credentials : {
        accessKeyId : process.env.ACCESS_ID,
        secretAccessKey : process.env.SECRET_ID,
    }
})
if (!process.env.ACCESS_ID || !process.env.SECRET_ID || !process.env.PROJECTID) {
    console.error("Missing env vars: ACCESS_ID, SECRET_ID, or ProjectId");
    process.exit(1);
}

async function publish_log(log){
    await producer.send({topic : 'container-logs' , messages: [{key : 'log' , value: JSON.stringify({ProjectId , DEPLOYMENT_ID , log})}]})
}

async function updateDeploymentStatus(deploymentId, newStatus) {
  const query = `
    UPDATE "Deployment"
    SET status = $1
    WHERE id = $2
    RETURNING *;
  `;
  const values = [newStatus, deploymentId];
  const result = await pool.query(query, values);
  return result.rows[0];
}

async function init(){
    console.log('db ', process.env.DATABASE_URL);
    await producer.connect();
    console.log("Executing script.js");
    await publish_log("Executing script.js")
    const outputDir = path.join(__dirname, 'output');
    await await updateDeploymentStatus(DEPLOYMENT_ID,'IN_PROGRESS');

    const p = exec(`cd ${outputDir} && npm install && ${process.env.build_command}`);


    p.stdout.on('data' , async(data) =>{
        console.log(data.toString());
        await publish_log(data.toString());
    })
    p.stdout.on('error' , async(data) =>{
        console.log('Error : ', data.toString());
        await publish_log(data.toString());
    })

    p.on('close' , async () =>{
        try{
                console.log("Build complete");
                await publish_log("Build complete");
                const distDir = path.join(__dirname , 'output' , 'dist');

                const distContent = fs.readdirSync(distDir , {recursive : true});

                for(const file of distContent){
                    const filepath = path.join(distDir , file);
                    if(fs.lstatSync(filepath).isDirectory()) continue;

                    console.log("Uploading filepath");
                    await publish_log("Uploading filepath");
                    const command = new PutObjectCommand({
                        Bucket : 'git-auto',
                        Key :  `__output/${DEPLOYMENT_ID}/${file}`,
                        Body : fs.createReadStream(filepath),
                        ContentType : mime.lookup(filepath),
                    })
                    await s3Client.send(command);
                    console.log(`Uploaded ${filepath}`);
                    await publish_log(`Uploaded ${filepath}`);
                }
                console.log("Done Uploading");
                await publish_log("Done Uploading");
                await updateDeploymentStatus(DEPLOYMENT_ID,'READY');

        }catch{
            await updateDeploymentStatus(DEPLOYMENT_ID,'FAILED');
        }
        process.exit(0);

    })
}
init();
