import SwiftUI
import MapKit

struct OrderMapView: View {
    @StateObject private var viewModel = OrderMapViewModel()
    @State private var region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 55.7558, longitude: 37.6173),
        span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
    )

    var body: some View {
        ZStack {
            Map(coordinateRegion: $region, annotationItems: viewModel.orders) { order in
                MapAnnotation(coordinate: order.location.coordinate) {
                    OrderAnnotationView(order: order)
                }
            }
            .ignoresSafeArea()
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    Button(action: { viewModel.centerOnUser() }) {
                        Image(systemName: "location.fill")
                            .font(.title2)
                            .padding()
                            .background(.regularMaterial)
                            .clipShape(Circle())
                    }
                    .padding()
                }
                Button(action: { viewModel.createOrder() }) {
                    HStack {
                        Image(systemName: "plus")
                        Text("Новый заказ")
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color(hex: "0055FF"))
                    .foregroundColor(.white)
                    .cornerRadius(12)
                }
                .padding()
            }
        }
        .sheet(isPresented: $viewModel.showingOrderForm) {
            CreateOrderView()
        }
    }
}

struct OrderAnnotationView: View {
    let order: Order
    @State private var isSelected = false

    var body: some View {
        VStack {
            ZStack {
                Circle()
                    .fill(Color(hex: "0055FF"))
                    .frame(width: 40, height: 40)
                Image(systemName: "shield.fill")
                    .foregroundColor(.white)
            }
            .onTapGesture {
                withAnimation { isSelected.toggle() }
            }
            if isSelected {
                VStack(alignment: .leading, spacing: 4) {
                    Text(order.title)
                        .font(.headline)
                    Text(order.location.address ?? "")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    HStack {
                        ForEach(order.requiredLicenses.prefix(3)) { license in
                            LicenseBadge(type: license, small: true)
                        }
                    }
                }
                .padding()
                .background(.regularMaterial)
                .cornerRadius(12)
                .shadow(radius: 5)
            }
        }
    }
}
