import { useQuery } from '@tanstack/react-query';
import { getPosts } from './api';
import { Post } from './types';

export const usePosts = () => {
  return useQuery<Post[]>({
    queryKey: ['posts'],
    queryFn: () => getPosts()
  });
};;