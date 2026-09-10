'use strict';
const express=require('express');
const mysql=require('mysql2/promise');
const fs=require('node:fs/promises');
const db=require('../config/database');
const {requireLogin,requireHRAccess}=require('../middleware/auth');
const upload=require('../middleware/upload');
const service=require('../utils/probation-service');
const router=express.Router();
function endpoint(action) {
    return async(req,res)=>{
        let c;
        res.set('Cache-Control','no-store');
        try {
            const {host,port,user,password,database,socketPath,ssl,timezone}=db.config;
            c=await mysql.createConnection({host,port,user,password,database,socketPath,ssl,timezone});
            res.json(await action(c,req));
        } catch(error) {
            // Upload belongs to this new submission and is not referenced after a rollback.
            if(req.file?.path) await fs.unlink(req.file.path).catch(e=>console.error('Failed upload cleanup:',e.code));
            const status=error.status||500;
            if(status===500) console.error('Probation API error:',error);
            res.status(status).json({success:false,message:status===500?'Unable to process probation request. Check server log.':error.message});
        } finally {if(c)await c.end().catch(()=>{});}
    };
}
const id=req=>req.session.user.user_id;
router.post('/api/submit-probation-confirmation',requireHRAccess,upload.single('attachment'),
    endpoint((c,req)=>service.submit(c,id(req),req.body,req.file?'uploads/'+req.file.filename:null)));
router.get('/api/probation-confirmations/my-requests',requireLogin,endpoint((c,req)=>service.mine(c,id(req))));
router.get('/api/probation-confirmations/approval-queue',requireLogin,endpoint((c,req)=>service.queue(c,id(req))));
router.get('/api/probation-confirmations/notifications',requireLogin,endpoint((c,req)=>service.notifications(c,id(req))));
router.get('/api/probation-confirmations/:id',requireLogin,endpoint((c,req)=>service.details(c,id(req),req.params.id)));
router.put('/api/probation-confirmations/:id/decision',requireLogin,endpoint((c,req)=>service.decide(c,id(req),req.params.id,req.body)));
const isProbation=value=>['probation','probation confirmation','probation-confirmation','probation_confirmation'].includes(String(value||'').trim().toLowerCase());
router.get('/api/request-details',(req,res,next)=>{
    if(!isProbation(req.query.type))return next();
    requireLogin(req,res,()=>endpoint((c,r)=>service.details(c,id(r),r.query.id))(req,res));
});
router.put('/api/approval-queue/:type/:id',(req,res,next)=>{
    if(!isProbation(req.params.type))return next();
    requireLogin(req,res,()=>endpoint((c,r)=>service.decide(c,id(r),r.params.id,r.body))(req,res));
});
module.exports=router;
