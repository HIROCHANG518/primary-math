// 用 macOS Vision 对扫描版 PDF 做中文 OCR，同时导出每页图片
// 用法: ocr <input.pdf> <outdir>
import Foundation
import PDFKit
import Vision
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

struct Line: Codable {
    let text: String
    let x: Double
    let y: Double
    let w: Double
    let h: Double
    let conf: Float
}

struct PageResult: Codable {
    let page: Int
    let width: Double
    let height: Double
    let lines: [Line]
}

func renderPage(_ page: PDFPage, scale: CGFloat) -> CGImage? {
    let rect = page.bounds(for: .mediaBox)
    let w = Int(rect.width * scale)
    let h = Int(rect.height * scale)
    guard w > 0, h > 0 else { return nil }
    let cs = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8,
                              bytesPerRow: 0, space: cs,
                              bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { return nil }
    ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
    ctx.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: ctx)
    return ctx.makeImage()
}

func saveJPEG(_ img: CGImage, to url: URL, quality: CGFloat) {
    guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else { return }
    CGImageDestinationAddImage(dest, img, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
    CGImageDestinationFinalize(dest)
}

let args = CommandLine.arguments
guard args.count >= 3 else {
    FileHandle.standardError.write("usage: ocr <input.pdf> <outdir>\n".data(using: .utf8)!)
    exit(2)
}
let pdfURL = URL(fileURLWithPath: args[1])
let outDir = URL(fileURLWithPath: args[2])

try? FileManager.default.createDirectory(at: outDir.appendingPathComponent("pages"), withIntermediateDirectories: true)
try? FileManager.default.createDirectory(at: outDir.appendingPathComponent("txt"), withIntermediateDirectories: true)

guard let doc = PDFDocument(url: pdfURL) else {
    FileHandle.standardError.write("cannot open pdf\n".data(using: .utf8)!)
    exit(1)
}

let total = doc.pageCount
var results: [PageResult] = []
let start = Date()

for i in 0..<total {
    guard let page = doc.page(at: i) else { continue }
    let scale: CGFloat = 2.0
    guard let cg = renderPage(page, scale: scale) else { continue }

    let pageNo = i + 1
    let imgURL = outDir.appendingPathComponent(String(format: "pages/p%03d.jpg", pageNo))
    saveJPEG(cg, to: imgURL, quality: 0.72)

    var lines: [Line] = []
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.usesLanguageCorrection = true
    req.recognitionLanguages = ["zh-Hans", "en-US"]
    req.minimumTextHeight = 0.004

    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
    do {
        try handler.perform([req])
        if let obs = req.results {
            for o in obs {
                guard let cand = o.topCandidates(1).first else { continue }
                let bb = o.boundingBox
                lines.append(Line(text: cand.string,
                                  x: Double(bb.origin.x), y: Double(1.0 - bb.origin.y - bb.height),
                                  w: Double(bb.width), h: Double(bb.height),
                                  conf: cand.confidence))
            }
        }
    } catch {
        FileHandle.standardError.write("ocr fail p\(pageNo): \(error)\n".data(using: .utf8)!)
    }

    // 按阅读顺序：先上下（行带），再左右
    lines.sort { a, b in
        if abs(a.y - b.y) > max(a.h, b.h) * 0.6 { return a.y < b.y }
        return a.x < b.x
    }

    let pr = PageResult(page: pageNo, width: Double(cg.width), height: Double(cg.height), lines: lines)
    results.append(pr)

    let txt = lines.map { $0.text }.joined(separator: "\n")
    try? txt.write(to: outDir.appendingPathComponent(String(format: "txt/p%03d.txt", pageNo)), atomically: true, encoding: .utf8)

    if pageNo % 10 == 0 || pageNo == total {
        let el = Date().timeIntervalSince(start)
        FileHandle.standardError.write("page \(pageNo)/\(total)  elapsed \(String(format: "%.1f", el))s\n".data(using: .utf8)!)
    }
}

let enc = JSONEncoder()
enc.outputFormatting = [.withoutEscapingSlashes]
if let data = try? enc.encode(results) {
    try? data.write(to: outDir.appendingPathComponent("pages.json"))
}
print("done pages=\(total) lines=\(results.reduce(0) { $0 + $1.lines.count })")
