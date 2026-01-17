import { RemotePattern } from "next/dist/shared/lib/image-config";

export const remotePatterns : RemotePattern[] = [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      }
]