declare module "heic-convert" {
  type ConvertInput = {
    buffer: Buffer | Uint8Array | ArrayBuffer;
    format: "JPEG" | "PNG";
    quality?: number;
  };

  function convert(input: ConvertInput): Promise<ArrayBuffer>;

  export default convert;
}
