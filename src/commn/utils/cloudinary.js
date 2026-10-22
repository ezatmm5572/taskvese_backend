import { v2 as cloudinary } from 'cloudinary'
import { CLOUDENARY_API_KEY, CLOUDENARY_API_SECRET, CLOUDENARY_CLOUD_NAME } from '../../../config/config.env.js';

cloudinary.config({
    cloud_name: CLOUDENARY_CLOUD_NAME,
    api_key: CLOUDENARY_API_KEY,
    api_secret: CLOUDENARY_API_SECRET,
});

export default cloudinary