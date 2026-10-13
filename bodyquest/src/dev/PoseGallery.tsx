import { POSES } from '../illustrations/poses';
import { FigureSvg } from '../illustrations/FigureSvg';

/** Developer page: renders every pose for visual QA (route: /dev/poses). */
export default function PoseGallery() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8, padding: 12 }}>
      {Object.keys(POSES).map((id) => (
        <div key={id} style={{ border: '1px solid #ccc', borderRadius: 8, padding: 4 }}>
          <FigureSvg pose={id} title={id} label={id} props={['mat']} />
        </div>
      ))}
    </div>
  );
}
