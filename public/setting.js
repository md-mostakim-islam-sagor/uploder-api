// Website er public setting (browser e dekha jay, tai ekhane kono token/secret rakhbe na)
// Token gulo config.json e rakho.
window.SITE_SETTINGS = {
  siteName: "Media Uploader",
  tagline: "Upload images & media and get direct links instantly",

  // Favicon (tab icon) er image link. Faka rakhle default blue icon dekhabe.
  // Example: "https://i.ibb.co/xxxx/logo.png"
  faviconUrl: "",

  // Vercel serverless function body limit 4.5 MB, tai 4 er beshi dio na
  maxFileSizeMB: 4,

  apiEndpoint: "/api/upload",
  footerText: "Powered by Imgur, Catbox & ImgBB",

  // Page gulo:  domain.com/?im  =  Imgur,  domain.com/?cbx  =  Catbox,  domain.com/?img  =  ImgBB
  hosts: {
    im: {
      id: "imgur",
      name: "Imgur",
      desc: "Fast image & short video hosting with permanent links.",
      accept: "image/*,video/mp4,video/webm"
    },
    cbx: {
      id: "catbox",
      name: "Catbox",
      desc: "Upload any media - images, video, audio or files.",
      accept: ""
    },
    img: {
      id: "imgbb",
      name: "ImgBB",
      desc: "Simple, reliable image hosting with direct links.",
      accept: "image/*"
    }
  }
};
