import axios from "axios";

export const isValidYouTubeUrl = (url) => {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
  return youtubeRegex.test(url);
};

export const getTitleAndThumbnail = async (url) => {
  const response = await axios.get(`https://noembed.com/embed?url=${url}`);
  return {
    title: response.data.title,
    thumbnail: response.data.thumbnail_url,
  };
};
