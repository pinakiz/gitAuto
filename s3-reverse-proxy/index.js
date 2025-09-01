const express = require('express');
const httpProxy = require('http-proxy');
const { prisma } = require('./../db')
const app = express();
const PORT = 8000;

const baseAddr = "";

const proxy = httpProxy.createProxy();


app.use(async(req , res)=>{
    console.log('d')
    const hostName = req.hostname;  
    const subDomain = hostName.split('.')[0];
    const deployment = await prisma.deployment.findUnique({
        where :{
            sub_domain : subDomain,
        }
    })
    const deployment_id = deployment.id;

    const resolvesTo =  `${baseAddr}/${deployment_id}`;

    console.log(deployment);


    return proxy.web(req, res , {target : resolvesTo , changeOrigin : true});

})

proxy.on('proxyReq' , (proxyReq , req , res)=>{
    const url = req.url;
    if(url === '/')
        proxyReq.path += 'index.html'
})



app.listen(PORT , ()=>{
    console.log(`Reverse proxy server running at ${PORT}`);
})