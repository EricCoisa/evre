"use server";

import { Post } from "./types";

export async function getPosts(): Promise<Post[]> {
  const payloadUrl = `${process.env.NEXT_PUBLIC_PAYLOAD_URL || 'http://localhost:3008'}/api/posts?where[published][equals]=true&sort=-createdAt`;
  const res = await fetch(payloadUrl);
  if (!res.ok) throw new Error('Failed to fetch posts');
  const data = await res.json();
  return data.docs as Post[];
}
