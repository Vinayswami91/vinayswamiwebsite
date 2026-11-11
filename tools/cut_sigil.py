# Cut the neon sigil from its black field: luminance alpha for the glow, enclosed dark areas kept solid.
# Usage (needs Pillow + numpy): python tools/cut_sigil.py <black-background source> assets/images/
# Writes sigil.png, -900, -720, -small, favicon-48/192 and apple-touch-icon. Then fix the hero height attr in index.html if the ratio changed.
import sys; from PIL import Image; import numpy as np
src, out = sys.argv[1], sys.argv[2]
a=np.array(Image.open(src).convert('RGB')).astype(float); mx=a.max(-1)
dark=mx<=10
ext=np.zeros_like(dark); ext[0,:]=dark[0,:]; ext[-1,:]=dark[-1,:]; ext[:,0]=dark[:,0]; ext[:,-1]=dark[:,-1]
while True:  # grow the border-connected dark region (4-neighbour) until stable
    g=ext.copy(); g[1:]|=ext[:-1]; g[:-1]|=ext[1:]; g[:,1:]|=ext[:,:-1]; g[:,:-1]|=ext[:,1:]; g&=dark
    if (g==ext).all(): break
    ext=g
assert 0.4 < ext.mean() < 0.7, ext.mean()
alpha=np.clip(mx/40.0,0,1); alpha[dark & ~ext]=1.0; alpha[ext]=0
rgb=np.clip(a/np.maximum(alpha,1e-6)[...,None],0,255)*(alpha[...,None]>0)
im=Image.fromarray(np.dstack([rgb,alpha*255]).round().astype(np.uint8),'RGBA')
w,h=im.size; pad=int(w*0.01); c=Image.new('RGBA',(w+2*pad,h+2*pad),(0,0,0,0)); c.paste(im,(pad,pad)); im=c; w,h=im.size
q=lambda x: x.quantize(256,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.FLOYDSTEINBERG)
for W,n in [(1100,'sigil.png'),(900,'sigil-900.png'),(720,'sigil-720.png'),(240,'sigil-small.png')]:
    q(im.resize((W,round(h*W/w)),Image.LANCZOS)).save(out+n,optimize=True)
for S_,n in [(48,'favicon-48.png'),(192,'favicon-192.png'),(180,'apple-touch-icon.png')]:
    s=im.copy(); s.thumbnail((S_,S_),Image.LANCZOS); c=Image.new('RGBA',(S_,S_),(0,0,0,0)); c.paste(s,((S_-s.width)//2,(S_-s.height)//2)); c.save(out+n,optimize=True)
print('ext frac',ext.mean().round(3))
