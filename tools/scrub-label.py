# Replace regulatory small print (bottler address, NAFDAC no., barcode) with neutral concept text.
import sys
from PIL import Image, ImageDraw, ImageFont
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
d = ImageDraw.Draw(im)
blue = (0, 60, 178)
d.rectangle((1278, 510, 1722, 620), fill=blue)   # bottler + NAFDAC block
d.rectangle((1936, 174, 2104, 470), fill=blue)   # barcode
bold = ImageFont.truetype('/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf', 22)
reg = ImageFont.truetype('/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', 22)
d.text((1287, 522), 'UNOFFICIAL CONCEPT', font=bold, fill='white')
d.text((1287, 552), 'Fan-made interactive spec by @VOtakpor.', font=reg, fill='white')
d.text((1287, 580), 'Not affiliated with or endorsed by PepsiCo.', font=reg, fill='white')
im.save(out)
