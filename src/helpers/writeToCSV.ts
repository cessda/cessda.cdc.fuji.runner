import { logger } from "./logger.js";
import { Transform } from "json2csv";
import { parseAsync } from "json2csv";
import { createWriteStream } from 'fs';
import type { Readable } from "stream";

export async function resultsToCSV(csvData: Readable, filename: string, csvType: string) : Promise<void> {
    csvData.push(null);
    let fields: string[] = [];
    let outputLocal;
    if (csvType == "EVA"){
        outputLocal = createWriteStream(`../outputs/${filename}-EVA.csv`, { encoding: 'utf8' });
        fields = [
            'findable.rda_f1_01m.points',
            'findable.rda_f1_01d.points',
            'findable.rda_f1_02m.points',
            'findable.rda_f1_02d.points',
            'findable.rda_f2_01m.points',
            'findable.rda_f3_01m.points',
            'findable.rda_f4_01m.points',
            'accessible.rda_a1_01m.points',
            'accessible.rda_a1_02m.points',
            'accessible.rda_a1_02d.points',
            'accessible.rda_a1_03m.points',
            'accessible.rda_a1_03d.points',
            'accessible.rda_a1_04m.points',
            'accessible.rda_a1_04d.points',
            'accessible.rda_a1_05d.points',
            'accessible.rda_a1_1_01m.points',
            'accessible.rda_a1_1_01d.points',
            'accessible.rda_a1_2_01d.points',
            'accessible.rda_a2_01m.points',
            'interoperable.rda_i1_01m.points',
            'interoperable.rda_i1_01d.points',
            'interoperable.rda_i1_02m.points',
            'interoperable.rda_i1_02d.points',
            'interoperable.rda_i2_01m.points',
            'interoperable.rda_i2_01d.points',
            'interoperable.rda_i3_01m.points',
            'interoperable.rda_i3_01d.points',
            'interoperable.rda_i3_02m.points',
            'interoperable.rda_i3_02d.points',
            'interoperable.rda_i3_03m.points',
            'interoperable.rda_i3_04m.points',
            'reusable.rda_r1_01m.points',
            'reusable.rda_r1_1_01m.points',
            'reusable.rda_r1_1_02m.points',
            'reusable.rda_r1_1_03m.points',
            'reusable.rda_r1_2_01m.points',
            'reusable.rda_r1_2_02m.points',
            'reusable.rda_r1_3_01m.points',
            'reusable.rda_r1_3_01d.points',
            'reusable.rda_r1_3_02m.points',
            'reusable.rda_r1_3_02d.points',
            'Totalfindable',
            'Totalaccessible',
            'Totalinteroperable',
            'Totalreusable',
            'TotalFAIR',
            'studyURL',
            'publisher',
            'dateID',
            'uid',
            'pid'
        ];
    }
    else{
        outputLocal = createWriteStream(`../outputs/${filename}-FUJI.csv`, { encoding: 'utf8' });
        fields = [
            'summary.score_percent.A',
            'summary.score_percent.A1',
            'summary.score_percent.F',
            'summary.score_percent.F1',
            'summary.score_percent.F2',
            'summary.score_percent.F3',
            'summary.score_percent.F4',
            'summary.score_percent.FAIR',
            'summary.score_percent.I',
            'summary.score_percent.I1',
            'summary.score_percent.I2',
            'summary.score_percent.I3',
            'summary.score_percent.R',
            "summary.score_percent.R1",
            'summary.score_percent.R1_1',
            'summary.score_percent.R1_2',
            'summary.score_percent.R1_3',
            'request.object_identifier',
            'publisher',
            'dateID',
            'uid',
            'pid'
        ];
    }
    let opts;
    let transformOpts;
    let json2csv;
    opts = { fields };
    transformOpts = { objectMode: true };
    json2csv = new Transform(opts, transformOpts);
    let processor = csvData.pipe(json2csv).pipe(outputLocal);
    try {
        await parseAsync(processor, opts);
    } catch (err) {
        logger.error(`CSV writer Error: ${err}`)
    }
    //uploadFromMemory(fileName, fujiResults).catch0(console.error); //Write-to-Cloud-Bucket function
}