import { Colors } from '@/constants/Colors';
describe('Colors', () => {
    it('has required keys for light and dark', () => {
        expect(Colors.light.text).toBeTruthy();
        expect(Colors.dark.text).toBeTruthy();
    });
});
