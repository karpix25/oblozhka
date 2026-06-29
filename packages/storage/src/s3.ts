import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type StorageConfig = {
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicBaseUrl?: string;
};

export class ObjectStorage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl?: string;

  constructor(config: StorageConfig = {}) {
    this.bucket = config.bucket ?? process.env.S3_BUCKET ?? "";
    this.publicBaseUrl = config.publicBaseUrl ?? process.env.S3_PUBLIC_BASE_URL;
    this.client = new S3Client({
      endpoint: config.endpoint ?? process.env.S3_ENDPOINT,
      region: config.region ?? process.env.S3_REGION ?? "auto",
      credentials: {
        accessKeyId: config.accessKeyId ?? process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: config.secretAccessKey ?? process.env.S3_SECRET_ACCESS_KEY ?? ""
      },
      forcePathStyle: true
    });
  }

  async uploadBuffer(input: { key: string; body: Buffer; contentType: string }) {
    if (!this.bucket) {
      throw new Error("S3_BUCKET is required.");
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType
      })
    );

    return this.urlFor(input.key);
  }

  urlFor(key: string): string {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, "")}/${key}`;
    }
    return `s3://${this.bucket}/${key}`;
  }
}
