import fs from "node:fs/promises";
import path from "node:path/posix";
import { build as viteBuild, createLogger } from "vite";
import colors from "picocolors";
import * as babel from "@babel/core";

const cjsSrcFile = "temp/index.cjs.js";
const esmSrcFile = "temp/index.es.js";
const dstDir = "dist";
const cjsDstFile = `${dstDir}/cjs/index.cjs.js`;
const esmDstFile = `${dstDir}/esm/index.esm.js`;
const logger = createLogger();

function displayTime(time: number): string {
    // display: {X}ms
    if (time < 1000) {
        return `${time}ms`;
    }

    time = time / 1000;

    // display: {X}s
    if (time < 60) {
        return `${time.toFixed(2)}s`;
    }

    const mins = parseInt((time / 60).toString(), 10);
    const seconds = time % 60;
    const minuteString = `${mins}m`;
    const secondString = seconds < 1 ? "" : ` ${seconds.toFixed(0)}s`;

    // display: {X}m {Y}s
    return `${minuteString}m${secondString}`;
}

function prettySize(size: number): string {
    if (size < 1024) {
        return `${size} B`;
    } else if (size < 1024 * 1024) {
        const divisor = 1024;
        const rounded = (size / divisor).toFixed(2);
        return `${rounded} kB`;
    } else {
        const divisor = 1024 * 1024;
        const rounded = (size / divisor).toFixed(2);
        return `${rounded} mB`;
    }
}

async function transpile(src: string, dst: string): Promise<void> {
    const dstMap = `${dst}.map`;
    const result = await babel.transformFileAsync(src, {
        sourceMaps: true,
        comments: true,
    });
    if (!result) {
        throw new Error("babel transform failed");
    }
    const { code, map } = result;
    await Promise.all([
        fs.writeFile(dst, code ?? "", "utf-8"),
        fs.writeFile(dstMap, JSON.stringify(map), "utf-8"),
    ]);
    const stat = await Promise.all([fs.stat(dst), fs.stat(dstMap)]);
    const size = stat.map((it) => prettySize(it.size));
    logger.info(`${src} -> ${dst} ${colors.bold(size[0])} | map: ${size[1]}`);
}

export async function cli(): Promise<void> {
    const startTime = Date.now();
    await viteBuild();

    await fs.mkdir(path.dirname(cjsDstFile), { recursive: true });
    await fs.mkdir(path.dirname(esmDstFile), { recursive: true });

    console.log();
    console.log(
        colors.cyan(`babel v${babel.version}`),
        colors.green("transpiling..."),
    );

    await Promise.all([
        transpile(esmSrcFile, esmDstFile),
        transpile(cjsSrcFile, cjsDstFile),
    ]);

    const duration = displayTime(Date.now() - startTime);
    console.log();
    console.log(colors.green(`Build successful (${duration}) 🎉`));
}
