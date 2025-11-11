const crypto = require('crypto')
const OpenAi = require('openai')
const express = require('express')
const fs = require('fs')
const join = require('path').join
const { nanoid } = require('nanoid')

let encoder = new TextEncoder()
const ALGORITHM = 'aes-256-cbc'
const KEY = 'TfaHj4p1Xmpr8awVxtraOkRb5QU0x0fL'
const IV = encoder.encode('RopcdIcUQzZ6GE4q')

const app = express()
const PORT = 3000

let API_TOKENS = new Array()

app.use(express.json())
app.use(express.urlencoded({ extended: true })); // Necesario para que pueda leer las peticiones 
                                                 // de tipo json
app.use('/public', express.static(join(__dirname)))

function decrypt(text) { //No se pudo implementar esto
    var decipher = crypto.createDecipheriv(ALGORITHM, KEY, IV);
    decipher.setAutoPadding(false);

    var dec = decipher.update(text, 'base64', 'utf-8');
    dec += decipher.final('utf-8'); 
    return dec;
}

function encrypt(text) { // No se pudo implemetar esto
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, IV);
  let encrypted = cipher.update(encoder.encode(text));
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return encrypted.toString('base64');
};

async function getResponseAi(payload, api_tokens) {  
    for(let i = 0; i < api_tokens.length; i++){
        try{
            const client = new OpenAi({
                "baseURL": "https://openrouter.ai/api/v1",
                "apiKey": api_tokens[i]
            })
        
            const response = await client.chat.completions.create({
                messages: [
                { role:"user", content: payload }
              ],
              model: "deepseek/deepseek-chat-v3.1"
            });
        
            return response.choices[0].message.content // Detener for cuando acepte un token
        }catch(error){
            console.log(error)
        } // Para que pruebe todos los tokens
    }
}

// let users = JSON.parse(fs.readFileSync(join(__dirname, 'users.json')))
// users.push({"test": "test"})
// fs.writeFileSync(join(__dirname, 'users.json'), JSON.stringify(users))

/**
 * Esto obtendra la respuesta de la api
 */
app.get('/getresponse', (req, res) => {
    console.log("req : ", req.query)
    let users = JSON.parse(fs.readFileSync(join(__dirname, 'users.json'), 'utf-8'));
    for (let i = 0; i < users.length; i++) {
        if (users.at(i).session == req.query.session) {
            res.send( users.at(i).response)
            return;
        }
    }

    res.send( "No existe el usuario")
})

/**
 * Este adduser le devolvera al usuario un id de sesion aleatorio
 */
app.post('/adduser', (req, res) => {
    console.log('req body session: ', req.body)
    let users = JSON.parse(fs.readFileSync(join(__dirname, 'users.json'), 'utf-8'));
    for (let i = 0; i < users.length; i++) {
        if (users.at(i).session == req.body.session) {
            res.send(users.at(i).session);
            return;
        }
    }
    res.send(nanoid());
})

/**
 * Este endpoint añadira informacion al usuario dentro del archivo users.json
 */
app.post('/users', (req, res) => {
    let users = JSON.parse(fs.readFileSync(join(__dirname, 'users.json'), 'utf-8'));
    for (let i = 0; i < users.length; i++) {
        if (users.at(i).session == req.body.session) {
            users.at(i).payload = req.body.payload
            users.at(i).tokens = req.body.tokens
	    users.at(i).response = ""
            users.at(i).active = true

            fs.writeFileSync(join(__dirname, 'users.json'), JSON.stringify(users));
            res.status(200).send()
            return;
        }
    }
    users.push(req.body)
    fs.writeFileSync(join(__dirname, 'users.json'), JSON.stringify(users));

    res.status(200).send()
})

app.listen(PORT, () => {
    console.log('Server bind in http://localhost:3000')
})

setInterval(() => {
    let users = JSON.parse(fs.readFileSync(join(__dirname, 'users.json'), 'utf-8'));
    for (let i = 0; i < users.length; i++) {
        if(users.at(i).active == true){
            console.log("iteracion")
            getResponseAi(users.at(i).payload, users.at(i).tokens).then(res => {
                users.at(i).response = res
                users.at(i).active = false
                fs.writeFileSync(join(__dirname, 'users.json'), JSON.stringify(users))
                users = JSON.parse(fs.readFileSync(join(__dirname, 'users.json'), 'utf-8'))
            })
        }
    }
}, 1000)
