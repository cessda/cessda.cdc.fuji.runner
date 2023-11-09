import { logger } from "./logger.js";
import { Transform } from "json2csv";
import { parseAsync } from "json2csv";
import { createWriteStream } from 'fs';
import type { Readable } from "stream";

export async function resultsToCSV(csvFUJI: Readable, csvEVA: Readable, filename: string) {
    csvFUJI.push(null);
    csvEVA.push(null);
    const fujiOutputLocal = createWriteStream(`../outputs/${filename}-FUJI.csv`, { encoding: 'utf8' });
    const evaOutputLocal = createWriteStream(`../outputs/${filename}-EVA.csv`, { encoding: 'utf8' });
    //write fuji results to csv
    let fields: string[] = [];
    fields = [
        'value.summary.score_percent.A',
        'value.summary.score_percent.A1',
        'value.summary.score_percent.F',
        'value.summary.score_percent.F1',
        'value.summary.score_percent.F2',
        'value.summary.score_percent.F3',
        'value.summary.score_percent.F4',
        'value.summary.score_percent.FAIR',
        'value.summary.score_percent.I',
        'value.summary.score_percent.I1',
        'value.summary.score_percent.I2',
        'value.summary.score_percent.I3',
        'value.summary.score_percent.R',
        "value.summary.score_percent.R1",
        'value.summary.score_percent.R1_1',
        'value.summary.score_percent.R1_2',
        'value.summary.score_percent.R1_3',
        'value.request.object_identifier',
        'value.publisher',
        'value.dateID',
        'value.uid',
        'value.pid'
    ];
    let opts;
    let transformOpts;
    let json2csv;
    opts = { fields };
    transformOpts = { objectMode: true };
    json2csv = new Transform(opts, transformOpts);
    let processor = csvFUJI.pipe(json2csv).pipe(fujiOutputLocal);
    try {
        await parseAsync(processor, opts);
    } catch (err) {
        logger.error(`CSV writer Error: ${err}`)
    }
    //write eva results to csv
    fields = [
        'value.findable.rda_f1_01m.points',
        'value.findable.rda_f1_01d.points',
        'value.findable.rda_f1_02m.points',
        'value.findable.rda_f1_02d.points',
        'value.findable.rda_f2_01m.points',
        'value.findable.rda_f3_01m.points',
        'value.findable.rda_f4_01m.points',
        'value.accessible.rda_a1_01m.points',
        'value.accessible.rda_a1_02m.points',
        'value.accessible.rda_a1_02d.points',
        'value.accessible.rda_a1_03m.points',
        'value.accessible.rda_a1_03d.points',
        'value.accessible.rda_a1_04m.points',
        'value.accessible.rda_a1_04d.points',
        'value.accessible.rda_a1_05d.points',
        'value.accessible.rda_a1_1_01m.points',
        'value.accessible.rda_a1_1_01d.points',
        'value.accessible.rda_a1_2_01d.points',
        'value.accessible.rda_a2_01m.points',
        'value.interoperable.rda_i1_01m.points',
        'value.interoperable.rda_i1_01d.points',
        'value.interoperable.rda_i1_02m.points',
        'value.interoperable.rda_i1_02d.points',
        'value.interoperable.rda_i2_01m.points',
        'value.interoperable.rda_i2_01d.points',
        'value.interoperable.rda_i3_01m.points',
        'value.interoperable.rda_i3_01d.points',
        'value.interoperable.rda_i3_02m.points',
        'value.interoperable.rda_i3_02d.points',
        'value.interoperable.rda_i3_03m.points',
        'value.interoperable.rda_i3_04m.points',
        'value.reusable.rda_r1_01m.points',
        'value.reusable.rda_r1_1_01m.points',
        'value.reusable.rda_r1_1_02m.points',
        'value.reusable.rda_r1_1_03m.points',
        'value.reusable.rda_r1_2_01m.points',
        'value.reusable.rda_r1_2_02m.points',
        'value.reusable.rda_r1_3_01m.points',
        'value.reusable.rda_r1_3_01d.points',
        'value.reusable.rda_r1_3_02m.points',
        'value.reusable.rda_r1_3_02d.points',
        'value.studyURL',
        'value.publisher',
        'value.dateID',
        'value.uid',
        'value.pid'
    ];
    opts = { fields };
    transformOpts = { objectMode: true };
    json2csv = new Transform(opts, transformOpts);
    processor = csvEVA.pipe(json2csv).pipe(evaOutputLocal);
    try {
        await parseAsync(processor, opts);
    } catch (err) {
        logger.error(`CSV writer Error: ${err}`)
    }
}