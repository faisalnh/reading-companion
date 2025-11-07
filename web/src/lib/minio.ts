import { Client as MinioClient } from 'minio';

type MinioConfig = {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucketName: string;
};

let client: MinioClient | null = null;

const getConfig = (): MinioConfig => {
  const endPoint = process.env.MINIO_ENDPOINT;
  const port = Number(process.env.MINIO_PORT ?? 443);
  const useSSL = process.env.MINIO_USE_SSL !== 'false';
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;
  const bucketName = process.env.MINIO_BUCKET_NAME;

  if (!endPoint || !accessKey || !secretKey || !bucketName) {
    throw new Error('MinIO environment variables are missing.');
  }

  return {
    endPoint,
    port,
    useSSL,
    accessKey,
    secretKey,
    bucketName,
  };
};

export const getMinioClient = () => {
  if (client) {
    return client;
  }

  const { bucketName, ...clientConfig } = getConfig();
  void bucketName;
  client = new MinioClient(clientConfig);
  return client;
};

export const getMinioBucketName = () => getConfig().bucketName;
