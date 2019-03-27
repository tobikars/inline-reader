const SerialPort = require('serialport')
// pass the Serialport path based on your environment: 
// mac: /dev/tty.usbmodem18173B6DE11
// win: COM1 (or COM2, COM3 etc.)
// /dev/tty.usbmodemC17F020363  Datalogic


const Delimiter = require('@serialport/parser-delimiter')


console.log(Delimiter)


// const usage = require('./usage.js').usage
// console.log(usage)
let program = require('commander')
let colors = require('colors')

const fs = require('fs')
const moment = require('moment')

function deb(msg) { console.log(colors.blue(msg)) }

function micros(msg) {
    const time = process.hrtime();
    return (time[0] * 1e9 + time[1])/1000 /* microSeconds! */
}

const DEFAULTS = {
    // /dev/tty.usbmodem1A1715XN0151481
    //serialport: "/dev/tty.usbmodemC17F020363",
    serialport: "/dev/tty.usbmodem1A1715XN0151481",
    
    adminport: 8080,
    output: "scans/" + moment().format("YYYYMMDD-HHmmss") + "-scans.csv",
    headerlist: "time,url,extended_id,sequence",
    delimiter: "\t"
}

program
    .version('0.0.1', '-v, --version')
    .option('-s, --serialport [path]', 'path to the scanning-device serial port',  DEFAULTS.serialport)
    .option('-p, --adminport [port]', 'IP port for the webadmin', DEFAULTS.adminport)
    .option('-o, --output [file]', 'file to log the scans to', DEFAULTS.output )
    .option('--headerlist <headers>', 'format of the headerlist', DEFAULTS.headerlist )
    .option('--delimiter [delimiter]', 'a single-character delimiter for the fields, or use \"TAB\" for <TAB>s', "\t" )
    .option('-d --debug','debug mode')
program.on('--help', () => {
    console.log('')
    console.log('Examples:');
    console.log('  $ scanner --serialport <port> --adminport <port> --output <file>');
});
program.parse(process.argv); // get the other arguments

const DEBUG = true || program.debug

if (DEBUG) {
    deb("PROGRAM OPTIONS: " + JSON.stringify(program.opts(), null, 4))
}

let scanFile = program.output || DEFAULTS.output
let serialPort = program.serialport || DEFAULTS.serialport
let csv_header = program.headerlist || DEFAULTS.headerlist
let delimiter = program.delimiter || DEFAULTS.delimiter

if (delimiter === "TAB") {
    csv_header = csv_header.replace(/,/g,"\t") + "\n"
} else {
    csv_header = csv_header.replace(/,/g,delimiter) + "\n"
}

// all test reeals are 253mm 
const reelCircumference = 0.253

// load OUP codes
const reelIds = require('./testReels.js').OUPreel10

// const MODE = "OUP" // test mode with rotating fixed reel of either 5 or 10 codes. 
const MODE = "SERIAL" // just read all the code. 
//deb('port: ' +  serialPort)

const port = new SerialPort(serialPort, { baudRate: 115200 }, error => {
    console.log('error: ' + error)
    require('@serialport/bindings').list().then( (ports) => {
        console.log("Is your serialport " + colors.bold(serialPort) + " listed below ? : " )
        console.log(JSON.stringify(ports)) 
    });
})

function getExtendedId(qr) {
    const prefix = "HTTPS://ST4.CH/Q/"
    return qr.replace(prefix, "")
}

// helper to get nice timestamp
const stamp = () => moment().format("HH:mm.ss.SS")

// start the sequence from 1 (first code)
let sequence = 1
let code1 = 0;
let codes = [];

// write the header to the scans.csv
fs.appendFileSync(scanFile, csv_header)

const parser = port.pipe(new Delimiter({ delimiter: '\r' }))

port.flush( () => {
    console.log("Flushed serialport data")
})

parser.on('data', data => {
   // deb(data)
    console.log('DATA: ' + data)
    const qr = new String(data).trim().replace("\u0002","")
    const extended_id = getExtendedId(qr)
    const line = micros() + delimiter + qr + delimiter + extended_id + delimiter + sequence

    if (codes.indexOf(extended_id) >= 0) {
        // old QR code re-read
        console.log("(reread of " + extended_id + ")")
    } else {
        console.log( sequence + " extended_id: " + extended_id  )

        if (MODE === "OUP") {
            let numTestCodes = reelIds.length
            if (sequence > numTestCodes) {
                let n = reelIds.indexOf(extended_id) + 1 // number on the reel
                if (n == 1) {
                    // first code found. Rotation-speed:
                    if (code1 >  0) {
                        let t = micros()
                        let rotationTimeUS = t - code1 
                        console.log((rotationTimeUS/1e6).toFixed(2) + " s/rotation "
                         + (reelCircumference/(rotationTimeUS/1e6)).toFixed(2) + " m/s " + 
                         + ((rotationTimeUS/1e3)/numTestCodes).toFixed(2) + " ms/code ") 
                    
                        if (codes[sequence-1-numTestCodes] !== extended_id) {
                            console.log("ERROR! -------------------------------------------------------> " + codes[sequence-1-numTestCodes])
                            console.log("DOES NOT MATCH -----------------------------------------------> " + extended_id)

                        }
                        code1 = t
                    } else {
                        // gotta set first scantime for code1:
                        code1 = micros()
                    }
                }
            }
        }
        codes.push(extended_id)
        sequence++;
    
        if (qr.length != 48) { 
            console.log("ERROR : BAD QR READ: " + qr + "(length " + qr.length + ")")
        } else {
            fs.appendFileSync(scanFile,  line + "\n")
        }
        
    }
})
