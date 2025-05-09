import { opendir, readFile } from "fs/promises";
import { resultsToCSV } from "./helpers/writeToCSV.js";
import { Readable } from "stream";

// Create a CSV from a directory of evaluated FAIR results

const runDate = new Date();
const assessDate = [runDate.getFullYear(), runDate.getMonth() + 1, runDate.getDate(), runDate.getHours(), runDate.getMinutes(), runDate.getSeconds()].join('-');

const studiesList = new Readable({ objectMode: true })
studiesList._read = () => { };

const studiesDir = await opendir("../outputs/datacatalogue.cessda.eu");
for await (const entry of studiesDir) {
	const text = await readFile(entry.path + '/' + entry.name, {encoding: "utf-8"});
	const study = JSON.parse(text);
	studiesList.push(study);
}

resultsToCSV(studiesList, "StudiesAssessment_" + assessDate, "FUJI");
