const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')
const ByteLength = require('@serialport/parser-byte-length')
const Delimiter = require('@serialport/parser-delimiter')

const fs = require('fs')
const moment = require('moment')

// replace the Serialport path based on your environment: 
// mac: /dev/tty.usbmodem18173B6DE11
// win: COM1 (or COM2, COM3 etc.)
const serialPortPath = "/dev/tty.usbmodem18173B6DE11"
const port = new SerialPort(serialPortPath, { baudRate: 115200 })

const prefix = "HTTPS://ST4.CH/Q/"
const filename =  "scans/" + moment().format("YYYYMMDD-HHmmss") + "-scans.csv"
const csv_header="time\turl\textended_id\tsequence\n"

// helper to get nice timestamp
const stamp = () => moment().format("HH:mm.ss.SS")

// start the sequence from 1 (first code)
let sequence = 1;
// write the header to the scans.csv
fs.appendFileSync(filename, csv_header)

const parser = port.pipe(new Delimiter({ delimiter: '\t' }))
parser.on('data', qr => {
    const extended_id = (""+qr).replace(prefix, "")
    const time = stamp()
    const line = time + "\t" + qr + "\t" + extended_id + "\t" + sequence + "\t"
    sequence++;
    console.log("> " + line )
    fs.appendFileSync(filename,  line + "\n")
})
