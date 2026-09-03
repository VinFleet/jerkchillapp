import Capacitor
import UIKit

/**
 * The app's bridge controller — exists to register app-local plugins.
 *
 * Capacitor's auto-registration only scans npm plugin packages; a plugin
 * that lives in the app target (TcpPrintPlugin) registers here, in
 * capacitorDidLoad, per the documented custom-native-code pattern. The
 * storyboard points at this class instead of CAPBridgeViewController.
 */
class TillViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(TcpPrintPlugin())
    }
}
